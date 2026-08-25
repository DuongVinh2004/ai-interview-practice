import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../platform/prisma/prisma.service';
import { SseService } from '../platform/sse/sse.service';
import { AiOrchestratorService } from '../ai-orchestrator/ai-orchestrator.service';
import { DifficultyCalculator } from '../ai-orchestrator/difficulty/difficulty.calculator';
import { QueueName, JobName, SessionState, SseEventType } from '@ai-interview/contracts';
import { MetricsService } from '../platform/metrics/metrics.service';
import { TelemetryService } from '../platform/telemetry/telemetry.service';

import { StarRubric } from './rubrics/star-rubric';

interface EvaluateAnswerJobData {
  sessionId: string;
  turnId: string;
  turnNumber: number;
  answerId: string;
  traceparent?: string;
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
    @Optional() private readonly metricsService?: MetricsService,
    @Optional() private readonly telemetryService?: TelemetryService,
  ) {
    super();
  }

  async process(job: Job<EvaluateAnswerJobData, any, string>): Promise<any> {
    if (job.name !== JobName.EVALUATE_ANSWER) {
      return;
    }

    const { sessionId, turnId, turnNumber, answerId, traceparent } = job.data;
    const startTime = Date.now();

    if (job.timestamp) {
      const lagSeconds = (Date.now() - job.timestamp) / 1000;
      this.metricsService?.bullmqQueueLagSeconds.observe(
        { queue: QueueName.ANSWER_EVALUATION, job_name: job.name },
        lagSeconds,
      );
    }

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
      this.metricsService?.bullmqJobsTotal.inc({
        queue: QueueName.ANSWER_EVALUATION,
        job_name: job.name,
        status: 'failed',
      });
      return;
    }

    // Pre-execution guard: Skip processing if session is already in a terminal state
    const terminalStates = [SessionState.CANCELLED, SessionState.COMPLETED, SessionState.FAILED];
    if (terminalStates.includes(session.state as SessionState)) {
      this.logger.warn(
        `Session ${sessionId} is in terminal state ${session.state}. Skipping answer evaluation.`,
      );
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

      // Persist Evaluation (H-006: dynamic totalTurns boundary)
      const totalTurns = session.totalTurns && session.totalTurns >= 1 ? session.totalTurns : 5;
      const isFinalTurn = turnNumber >= totalTurns;

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
            needsReview: evaluationResult.needsReview || false,
            authorityState: evaluationResult.needsReview ? 'NEEDS_REVIEW' : 'AUTHORITATIVE',
            provider: (evaluationResult as any).provider || undefined,
            fallbackReason: (evaluationResult as any).fallbackReason || undefined,
            confidence: evaluationResult.confidence || 0.85,
          },
          create: {
            answerId,
            score: evaluationResult.score,
            rubricScores: evaluationResult.rubricScores,
            strengths: evaluationResult.strengths,
            improvements: evaluationResult.improvements,
            conciseFeedback: evaluationResult.conciseFeedback,
            evidence: evaluationResult.evidence,
            needsReview: evaluationResult.needsReview || false,
            authorityState: evaluationResult.needsReview ? 'NEEDS_REVIEW' : 'AUTHORITATIVE',
            provider: (evaluationResult as any).provider || undefined,
            fallbackReason: (evaluationResult as any).fallbackReason || undefined,
            confidence: evaluationResult.confidence || 0.85,
          },
        });

        if (session.sessionMode === 'BEHAVIORAL') {
          const starResult = StarRubric.evaluate(answer.content);
          await tx.starEvaluation.upsert({
            where: { answerId },
            update: {
              situationText: starResult.extracted.situationText,
              taskText: starResult.extracted.taskText,
              actionText: starResult.extracted.actionText,
              resultText: starResult.extracted.resultText,
              situationScore: starResult.scores.situationScore,
              taskScore: starResult.scores.taskScore,
              actionScore: starResult.scores.actionScore,
              resultScore: starResult.scores.resultScore,
              structureScore: starResult.scores.structureScore,
              totalScore: starResult.scores.totalScore,
              feedback: starResult.feedback,
            },
            create: {
              answerId,
              situationText: starResult.extracted.situationText,
              taskText: starResult.extracted.taskText,
              actionText: starResult.extracted.actionText,
              resultText: starResult.extracted.resultText,
              situationScore: starResult.scores.situationScore,
              taskScore: starResult.scores.taskScore,
              actionScore: starResult.scores.actionScore,
              resultScore: starResult.scores.resultScore,
              structureScore: starResult.scores.structureScore,
              totalScore: starResult.scores.totalScore,
              feedback: starResult.feedback,
            },
          });
        }

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
          const overallScore = Number((totalScore / Math.max(allEvaluations.length, 1)).toFixed(1));

          await tx.interviewSession.updateMany({
            where: {
              id: sessionId,
              state: { notIn: [SessionState.CANCELLED, SessionState.COMPLETED] },
            },
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

          await tx.interviewSession.updateMany({
            where: {
              id: sessionId,
              state: { notIn: [SessionState.CANCELLED, SessionState.COMPLETED, SessionState.FAILED] },
            },
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

      // Record business & worker metrics
      const durationSec = (Date.now() - startTime) / 1000;
      this.metricsService?.bullmqJobsTotal.inc({
        queue: QueueName.ANSWER_EVALUATION,
        job_name: job.name,
        status: 'completed',
      });
      this.metricsService?.bullmqJobDurationSeconds.observe(
        { queue: QueueName.ANSWER_EVALUATION, job_name: job.name },
        durationSec,
      );
      this.metricsService?.evaluationsTotal.inc({
        role: session.jobRole.name,
        level: session.seniorityLevel.name,
        pass_fail: evaluationResult.score >= 6.0 ? 'pass' : 'fail',
      });
      this.metricsService?.evaluationScoreDistribution.observe(
        { role: session.jobRole.name, level: session.seniorityLevel.name },
        evaluationResult.score,
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
          confidence: evaluationResult.confidence || 0.85,
          missingConcepts: evaluationResult.missingConcepts || [],
          needsReview: evaluationResult.needsReview || false,
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
              traceparent,
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
          { sessionId, traceparent },
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
      const durationSec = (Date.now() - startTime) / 1000;
      this.metricsService?.bullmqJobsTotal.inc({
        queue: QueueName.ANSWER_EVALUATION,
        job_name: job.name,
        status: 'failed',
      });
      this.metricsService?.bullmqJobDurationSeconds.observe(
        { queue: QueueName.ANSWER_EVALUATION, job_name: job.name },
        durationSec,
      );

      this.logger.error(
        `Error evaluating answer for session ${sessionId}: ${error.message}`,
        error.stack,
      );
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
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
