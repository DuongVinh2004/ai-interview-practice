import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobName, QueueName, SessionState } from '@ai-interview/contracts';
import { Queue } from 'bullmq';
import { PrismaService } from '../platform/prisma/prisma.service';
import { RedisService } from '../platform/redis/redis.service';

@Injectable()
export class InterviewQueueReconciliationCron {
  private readonly logger = new Logger(InterviewQueueReconciliationCron.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QueueName.ANSWER_EVALUATION) private readonly evaluationQueue: Queue,
    @InjectQueue(QueueName.QUESTION_GENERATION) private readonly questionQueue: Queue,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcile(): Promise<void> {
    const redis = this.redisService?.getClient();
    const lockKey = 'lock:cron:interview-queue-reconciliation';
    const lockValue = `${Date.now()}-${Math.random()}`;
    let lockAcquired = false;

    if (redis && redis.status === 'ready') {
      try {
        const res = await redis.set(lockKey, lockValue, 'EX', 55, 'NX');
        if (!res) {
          this.logger.debug('Reconciliation lock held by another cluster instance; skipping.');
          return;
        }
        lockAcquired = true;
      } catch (err: any) {
        this.logger.warn(`Redis lock check failed, proceeding fail-safe: ${err.message}`);
      }
    }

    try {
      const [answersAwaitingDispatch, questionsAwaitingDispatch] = await Promise.all([
        this.prisma.interviewTurn.findMany({
          where: {
            status: 'ANSWER_SUBMITTED',
            answer: { isNot: null },
            session: { state: SessionState.EVALUATING },
          },
          include: { answer: true, session: { select: { id: true } } },
          take: 100,
        }),
        this.prisma.interviewTurn.findMany({
          where: {
            status: 'PENDING',
            session: { state: SessionState.ACTIVE },
          },
          include: { session: { select: { id: true, currentTurn: true } } },
          take: 100,
        }),
      ]);

      for (const turn of answersAwaitingDispatch) {
        if (!turn.answer) continue;
        try {
          await this.evaluationQueue.add(
            JobName.EVALUATE_ANSWER,
            {
              sessionId: turn.session.id,
              turnId: turn.id,
              turnNumber: turn.turnNumber,
              answerId: turn.answer.id,
            },
            {
              jobId: `eval-${turn.session.id}-turn-${turn.turnNumber}`,
              attempts: 3,
              backoff: { type: 'exponential', delay: 1000 },
            },
          );
        } catch (error: any) {
          this.logger.warn(
            `Evaluation dispatch reconciliation failed for turn ${turn.id}: ${error.message}`,
          );
        }
      }

      for (const turn of questionsAwaitingDispatch) {
        if (turn.session.currentTurn !== turn.turnNumber) continue;
        try {
          await this.questionQueue.add(
            JobName.GENERATE_QUESTION,
            {
              sessionId: turn.session.id,
              turnId: turn.id,
              turnNumber: turn.turnNumber,
              difficulty: turn.difficulty,
            },
            {
              jobId: `question-${turn.session.id}-turn-${turn.turnNumber}`,
              attempts: 3,
              backoff: { type: 'exponential', delay: 1000 },
            },
          );
        } catch (error: any) {
          this.logger.warn(
            `Question dispatch reconciliation failed for turn ${turn.id}: ${error.message}`,
          );
        }
      }
    } finally {
      if (lockAcquired && redis && redis.status === 'ready') {
        try {
          const currentVal = await redis.get(lockKey);
          if (currentVal === lockValue) {
            await redis.del(lockKey);
          }
        } catch {
          // ignore lock release error
        }
      }
    }
  }
}
