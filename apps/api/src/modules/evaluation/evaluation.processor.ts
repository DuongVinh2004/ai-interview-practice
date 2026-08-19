import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../platform/prisma/prisma.service';
import { SseService } from '../platform/sse/sse.service';
import { AiOrchestratorService } from '../ai-orchestrator/ai-orchestrator.service';
import { DifficultyCalculator } from '../ai-orchestrator/difficulty/difficulty.calculator';
import { QueueName, JobName, SessionState, SseEventType } from '@ai-interview/contracts';

interface EvaluateAnswerJobData {
  sessionId: string;
  turnId: string;
  turnNumber: number;
  answerId: string;
}

@Processor(QueueName.ANSWER_EVALUATION)
export class EvaluationProcessor extends WorkerHost {
  private readonly logger = new Logger(EvaluationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sseService: SseService,
    private readonly aiOrchestrator: AiOrchestratorService,
    @InjectQueue(QueueName.QUESTION_GENERATION)
    private readonly questionQueue: Queue,
    @InjectQueue(QueueName.LEARNING_PATH)
    private readonly learningPathQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<EvaluateAnswerJobData, any, string>): Promise<any> {
    if (job.name !== JobName.EVALUATE_ANSWER) {
      return;
    }

    const { sessionId, turnId, turnNumber, answerId } = job.data;
    this.logger.log(
      `Processing answer evaluation for session ${sessionId}, turn ${turnNumber} (Job ${job.id})`,
    );

    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        jobRole: true,
        seniorityLevel: true,
        turns: {
          where: { id: turnId },
          include: { question: true, answer: true },
        },
      },
    });

    if (!session || !session.turns[0] || !session.turns[0].question || !session.turns[0].answer) {
      this.logger.error(`Session, turn, question, or answer missing for job ${job.id}`);
      return;
    }

    const turn = session.turns[0];
    const question = turn.question!;
    const answer = turn.answer!;

    try {
      const evaluationResult = await this.aiOrchestrator.evaluateAnswer(sessionId, {
        role: session.jobRole.name,
        level: session.seniorityLevel.name,
        question: question.content,
        keyFocus: question.keyFocus || undefined,
        expectedPoints: (question.expectedPoints as string[]) || undefined,
        answer: answer.content,
      });

      // Calculate next difficulty
      const nextDifficulty = DifficultyCalculator.calculateNextDifficulty(
        turn.difficulty,
        evaluationResult.score,
      );

      // Persist Evaluation
      const isFinalTurn = turnNumber >= 5;

      const evaluation = await this.prisma.$transaction(async tx => {
        const evalRecord = await tx.evaluation.upsert({
          where: { answerId },
          update: {
            score: evaluationResult.score,
            rubricScores: evaluationResult.rubricScores,
            strengths: evaluationResult.strengths,
            improvements: evaluationResult.improvements,
            conciseFeedback: evaluationResult.conciseFeedback,
            evidence: evaluationResult.evidence,
          },
          create: {
            answerId,
            score: evaluationResult.score,
            rubricScores: evaluationResult.rubricScores,
            strengths: evaluationResult.strengths,
            improvements: evaluationResult.improvements,
            conciseFeedback: evaluationResult.conciseFeedback,
            evidence: evaluationResult.evidence,
          },
        });

        await tx.interviewTurn.update({
          where: { id: turnId },
          data: { status: 'EVALUATED' },
        });

        if (isFinalTurn) {
          // Calculate overall score from all turns
          const allEvaluations = await tx.evaluation.findMany({
            where: {
              answer: {
                turn: { sessionId },
              },
            },
          });

          const totalScore = allEvaluations.reduce((sum, e) => sum + e.score, 0);
          const overallScore = Number((totalScore / allEvaluations.length).toFixed(1));

          await tx.interviewSession.update({
            where: { id: sessionId },
            data: {
              state: SessionState.COMPLETED,
              overallScore,
              completedAt: new Date(),
            },
          });
        } else {
          // Prepare next turn
          const nextTurnNumber = turnNumber + 1;
          await tx.interviewTurn.updateMany({
            where: { sessionId, turnNumber: nextTurnNumber },
            data: { difficulty: nextDifficulty },
          });

          await tx.interviewSession.update({
            where: { id: sessionId },
            data: {
              state: SessionState.ACTIVE,
              currentTurn: nextTurnNumber,
              targetDifficulty: nextDifficulty,
            },
          });
        }

        return evalRecord;
      });

      this.logger.log(
        `Evaluation saved for session ${sessionId} turn ${turnNumber}. Score: ${evaluationResult.score}/10.`,
      );

      // Emit SSE Evaluation event
      this.sseService.emitSessionEvent(sessionId, SseEventType.EVALUATION_COMPLETED, {
        sessionId,
        turnNumber,
        evaluation: {
          id: evaluation.id,
          answerId,
          score: evaluation.score,
          rubricScores: evaluation.rubricScores,
          strengths: evaluation.strengths,
          improvements: evaluation.improvements,
          conciseFeedback: evaluation.conciseFeedback,
          evidence: evaluation.evidence,
          createdAt: evaluation.createdAt.toISOString(),
        },
      });

      if (!isFinalTurn) {
        // Enqueue next question generation
        const nextTurnNumber = turnNumber + 1;
        const nextTurn = await this.prisma.interviewTurn.findFirst({
          where: { sessionId, turnNumber: nextTurnNumber },
        });

        if (nextTurn) {
          const nextJobId = `question-${sessionId}-turn-${nextTurnNumber}`;
          await this.questionQueue.add(
            JobName.GENERATE_QUESTION,
            {
              sessionId,
              turnId: nextTurn.id,
              turnNumber: nextTurnNumber,
              difficulty: nextDifficulty,
            },
            {
              jobId: nextJobId,
              attempts: 3,
              backoff: { type: 'exponential', delay: 1000 },
            },
          );
        }
      } else {
        // Enqueue learning path generation after 5th turn completed
        const lpJobId = `lp-${sessionId}`;
        await this.learningPathQueue.add(
          JobName.GENERATE_LEARNING_PATH,
          { sessionId },
          {
            jobId: lpJobId,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          },
        );

        this.sseService.emitSessionEvent(sessionId, SseEventType.SESSION_UPDATED, {
          sessionId,
          state: SessionState.COMPLETED,
        });
      }

      return evaluation;
    } catch (error: any) {
      this.logger.error(
        `Error evaluating answer for session ${sessionId}: ${error.message}`,
        error.stack,
      );
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        // Keep already saved answer intact, set session status to FAILED
        await this.prisma.interviewSession.update({
          where: { id: sessionId },
          data: { state: SessionState.FAILED },
        });
        this.sseService.emitSessionEvent(sessionId, SseEventType.SESSION_FAILED, {
          sessionId,
          reason: 'Failed to evaluate answer after retries.',
        });
      }
      throw error;
    }
  }
}
