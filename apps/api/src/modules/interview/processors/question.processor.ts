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
      });

      // Persist question and activate session
      const question = await this.prisma.$transaction(async tx => {
        const q = await tx.question.upsert({
          where: { turnId },
          update: {
            content: generatedQuestion.content,
            keyFocus: generatedQuestion.keyFocus,
            expectedPoints: generatedQuestion.expectedKeyPoints,
            difficulty: generatedQuestion.suggestedDifficulty || difficulty,
          },
          create: {
            turnId,
            content: generatedQuestion.content,
            keyFocus: generatedQuestion.keyFocus,
            expectedPoints: generatedQuestion.expectedKeyPoints,
            difficulty: generatedQuestion.suggestedDifficulty || difficulty,
          },
        });

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
            state: { notIn: [SessionState.CANCELLED, SessionState.COMPLETED, SessionState.FAILED] },
          },
          data: {
            state: SessionState.ACTIVE,
            currentTurn: turnNumber,
            targetDifficulty: generatedQuestion.suggestedDifficulty || difficulty,
          },
        });

        if (sessionUpdateResult.count === 0) {
          this.logger.warn(`Session ${sessionId} is terminal (CANCELLED/COMPLETED). State not changed to ACTIVE.`);
        }

        return q;
      });

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
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        await this.prisma.interviewSession.updateMany({
          where: {
            id: sessionId,
            state: { notIn: [SessionState.CANCELLED, SessionState.COMPLETED] },
          },
          data: { state: SessionState.FAILED },
        });
        this.sseService.emitSessionEvent(sessionId, SseEventType.SESSION_FAILED, {
          sessionId,
          reason: 'Failed to generate interview question after retries.',
        });
      }
      throw error;
    }
  }
}
