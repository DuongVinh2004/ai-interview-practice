import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { SseService } from '../../platform/sse/sse.service';
import { AiOrchestratorService } from '../../ai-orchestrator/ai-orchestrator.service';
import { QueueName, JobName, SessionState, SseEventType } from '@ai-interview/contracts';

interface GenerateQuestionJobData {
  sessionId: string;
  turnId: string;
  turnNumber: number;
  difficulty: number;
}

@Processor(QueueName.QUESTION_GENERATION)
export class QuestionProcessor extends WorkerHost {
  private readonly logger = new Logger(QuestionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sseService: SseService,
    private readonly aiOrchestrator: AiOrchestratorService,
  ) {
    super();
  }

  async process(job: Job<GenerateQuestionJobData, any, string>): Promise<any> {
    if (job.name !== JobName.GENERATE_QUESTION) {
      return;
    }

    const { sessionId, turnId, turnNumber, difficulty } = job.data;
    this.logger.log(
      `Processing question generation for session ${sessionId}, turn ${turnNumber} (Job ${job.id})`,
    );

    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        jobRole: true,
        seniorityLevel: true,
        technologies: { include: { technology: true } },
        turns: {
          where: { turnNumber: { lt: turnNumber } },
          include: { answer: { include: { evaluation: true } } },
        },
      },
    });

    if (!session) {
      this.logger.error(`Session ${sessionId} not found`);
      return;
    }

    // Pre-execution guard: Skip processing if session is already in a terminal state
    const terminalStates = [SessionState.CANCELLED, SessionState.COMPLETED, SessionState.FAILED];
    if (terminalStates.includes(session.state as SessionState)) {
      this.logger.warn(
        `Session ${sessionId} is in terminal state ${session.state}. Skipping question generation.`,
      );
      return;
    }

    const targetTurn = await this.prisma.interviewTurn.findUnique({
      where: { id: turnId },
      include: { question: true },
    });
    if (!targetTurn) {
      this.logger.error(`Turn ${turnId} not found in session ${sessionId}`);
      return;
    }

    // Guard: If question already exists or turn is already ready/submitted/evaluated, skip replay
    if (targetTurn.question || targetTurn.status !== 'PENDING') {
      this.logger.warn(
        `Turn ${turnNumber} in session ${sessionId} already has question or is not in PENDING state (status=${targetTurn.status}). Skipping replay.`,
      );
      return;
    }

    // Atomic CAS claim: change status from PENDING to GENERATING_QUESTION
    const claimResult = await this.prisma.interviewTurn.updateMany({
      where: {
        id: turnId,
        sessionId,
        status: 'PENDING',
      },
      data: {
        status: 'GENERATING_QUESTION',
      },
    });

    if (claimResult.count === 0) {
      this.logger.warn(
        `Turn ${turnNumber} for session ${sessionId} could not be claimed for generation. Skipping duplicate execution.`,
      );
      return;
    }

    // Determine previous score if any
    let previousScore: number | undefined;
    if (turnNumber > 1) {
      const prevTurn = session.turns.find(t => t.turnNumber === turnNumber - 1);
      previousScore = prevTurn?.answer?.evaluation?.score;
    }

    const techNames = session.technologies.map(t => t.technology.name);

    try {
      const generatedQuestion = await this.aiOrchestrator.generateQuestion(sessionId, {
        role: session.jobRole.name,
        level: session.seniorityLevel.name,
        technologies: techNames,
        turnNumber,
        difficulty,
        previousScore,
        competencyArea: session.competencyArea || undefined,
        sessionMode: session.sessionMode,
        language: (session as any).language || 'vi',
      });

      // Persist question and activate session without overwriting existing question
      const { question, isTerminal } = await this.prisma.$transaction(async tx => {
        let q = await tx.question.findUnique({ where: { turnId } });
        if (!q) {
          q = await tx.question.create({
            data: {
              turnId,
              content: generatedQuestion.content,
              keyFocus: generatedQuestion.keyFocus,
              expectedPoints: generatedQuestion.expectedKeyPoints,
              difficulty: generatedQuestion.suggestedDifficulty || difficulty,
            },
          });
        }

        await tx.interviewTurn.update({
          where: { id: turnId },
          data: {
            status: 'QUESTION_READY',
            difficulty: generatedQuestion.suggestedDifficulty || difficulty,
          },
        });

        const sessionUpdateResult = await tx.interviewSession.updateMany({
          where: {
            id: sessionId,
            state: {
              in: [SessionState.CREATED, SessionState.ACTIVE],
            },
          },
          data: {
            state: SessionState.ACTIVE,
            currentTurn: turnNumber,
            targetDifficulty: generatedQuestion.suggestedDifficulty || difficulty,
          },
        });

        const terminal = sessionUpdateResult.count === 0;
        if (terminal) {
          this.logger.warn(
            `Session ${sessionId} is terminal (CANCELLED/COMPLETED). State not changed to ACTIVE.`,
          );
        }

        return { question: q, isTerminal: terminal };
      });

      if (isTerminal) {
        return question;
      }

      this.logger.log(
        `Question generated successfully for turn ${turnNumber} (Session: ${sessionId})`,
      );

      // Emit SSE events
      this.sseService.emitSessionEvent(sessionId, SseEventType.QUESTION_READY, {
        sessionId,
        turnNumber,
        question: {
          id: question.id,
          turnId,
          content: question.content,
          difficulty: question.difficulty,
          keyFocus: question.keyFocus,
          createdAt: question.createdAt.toISOString(),
        },
      });

      this.sseService.emitSessionEvent(sessionId, SseEventType.SESSION_UPDATED, {
        sessionId,
        state: SessionState.ACTIVE,
        currentTurn: turnNumber,
      });

      return question;
    } catch (error: any) {
      this.logger.error(
        `Error generating question for session ${sessionId}: ${error.message}`,
        error.stack,
      );
      try {
        await this.prisma.interviewTurn.updateMany({
          where: { id: turnId, status: 'GENERATING_QUESTION' },
          data: { status: 'PENDING' },
        });
      } catch {
        // Ignore secondary rollback error
      }
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        const failResult = await this.prisma.interviewSession.updateMany({
          where: {
            id: sessionId,
            state: { notIn: [SessionState.CANCELLED, SessionState.COMPLETED] },
          },
          data: { state: SessionState.FAILED },
        });
        if (failResult.count > 0) {
          this.sseService.emitSessionEvent(sessionId, SseEventType.SESSION_FAILED, {
            sessionId,
            reason: 'Failed to generate interview question after retries.',
          });
        } else {
          this.logger.warn(
            `Session ${sessionId} already in terminal state. Skipping SESSION_FAILED event.`,
          );
        }
      }
      throw error;
    }
  }
}
