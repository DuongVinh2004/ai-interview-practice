import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../platform/prisma/prisma.service';
import { PushNotificationService } from './push-notification.service';
import { RedisService } from '../platform/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StreakReminderCron {
  private readonly logger = new Logger(StreakReminderCron.name);
  private readonly instanceId = uuidv4();
  private localExecutionLocks = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushNotificationService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  /**
   * Run daily at 20:00 (8 PM) with distributed singleton lock (REL-003)
   */
  @Cron(CronExpression.EVERY_DAY_AT_8PM)
  async handleDailyStreakReminders() {
    const todayStr = new Date().toISOString().split('T')[0];
    const lockKey = `cron:lock:streak-reminder:${todayStr}`;
    const LOCK_TTL_SECONDS = 7200; // 2 hour distributed lock

    const acquired = await this.acquireDistributedLock(lockKey, LOCK_TTL_SECONDS);
    if (!acquired) {
      this.logger.log(
        `[REL-003] Daily streak reminder lock for ${todayStr} is already held by another replica. Skipping execution.`,
      );
      return;
    }

    this.logger.log(
      `[REL-003] Acquired distributed lock for streak reminders on ${todayStr}. Executing job...`,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const BATCH_SIZE = 100;
      let skip = 0;
      let totalNotified = 0;
      let hasMore = true;

      while (hasMore) {
        const atRiskStreaks = await this.prisma.userStreak.findMany({
          where: {
            currentStreak: { gt: 0 },
            OR: [{ lastReviewDate: null }, { lastReviewDate: { lt: today } }],
            user: {
              notificationPreference: {
                streakWarning: true,
              },
            },
          },
          include: {
            user: true,
          },
          skip,
          take: BATCH_SIZE,
          orderBy: { userId: 'asc' },
        });

        hasMore = atRiskStreaks.length === BATCH_SIZE;

        for (const streakRecord of atRiskStreaks) {
          try {
            await this.pushService.sendStreakWarning(
              streakRecord.userId,
              streakRecord.currentStreak,
            );
            totalNotified++;
          } catch (err: any) {
            this.logger.warn(
              `Failed to send streak reminder to user ${streakRecord.userId}: ${err.message}`,
            );
          }
        }

        skip += atRiskStreaks.length;
      }

      this.logger.log(
        `[REL-003] Successfully processed streak reminders. Total sent: ${totalNotified}`,
      );
    } catch (err: any) {
      this.logger.error(`Error in streak reminder cron: ${err.message}`, err.stack);
    }
  }

  private async acquireDistributedLock(lockKey: string, ttlSeconds: number): Promise<boolean> {
    if (this.redisService) {
      try {
        const client = this.redisService.getClient();
        if (client) {
          const result = await client.set(lockKey, this.instanceId, 'EX', ttlSeconds, 'NX');
          return result === 'OK';
        }
      } catch (err: any) {
        this.logger.warn(
          `Redis lock attempt failed, falling back to process-local locking: ${err.message}`,
        );
      }
    }

    // In-memory fallback
    if (this.localExecutionLocks.has(lockKey)) {
      return false;
    }
    this.localExecutionLocks.add(lockKey);
    return true;
  }

  /**
   * Manual trigger for testing and admin operations
   */
  async triggerManualRun(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const atRiskStreaks = await this.prisma.userStreak.findMany({
      where: {
        currentStreak: { gt: 0 },
        OR: [{ lastReviewDate: null }, { lastReviewDate: { lt: today } }],
      },
    });

    for (const streakRecord of atRiskStreaks) {
      await this.pushService.sendStreakWarning(streakRecord.userId, streakRecord.currentStreak);
    }

    return atRiskStreaks.length;
  }
}
