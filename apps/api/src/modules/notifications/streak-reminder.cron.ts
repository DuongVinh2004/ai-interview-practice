import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../platform/prisma/prisma.service';
import { PushNotificationService } from './push-notification.service';

@Injectable()
export class StreakReminderCron {
  private readonly logger = new Logger(StreakReminderCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushNotificationService,
  ) {}

  /**
   * Run daily at 20:00 (8 PM) to check for users with active streaks who haven't practiced today
   */
  @Cron(CronExpression.EVERY_DAY_AT_8PM)
  async handleDailyStreakReminders() {
    this.logger.log('Executing daily streak reminder cron job...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      // Find all users with streak > 0 whose lastReviewDate is before today
      const atRiskStreaks = await this.prisma.userStreak.findMany({
        where: {
          currentStreak: { gt: 0 },
          OR: [
            { lastReviewDate: null },
            { lastReviewDate: { lt: today } },
          ],
          user: {
            notificationPreference: {
              streakWarning: true,
            },
          },
        },
        include: {
          user: true,
        },
      });

      this.logger.log(`Found ${atRiskStreaks.length} candidates at risk of breaking their practice streak.`);

      for (const streakRecord of atRiskStreaks) {
        await this.pushService.sendStreakWarning(
          streakRecord.userId,
          streakRecord.currentStreak,
        );
      }
    } catch (err: any) {
      this.logger.error(`Error in streak reminder cron: ${err.message}`);
    }
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
        OR: [
          { lastReviewDate: null },
          { lastReviewDate: { lt: today } },
        ],
      },
    });

    for (const streakRecord of atRiskStreaks) {
      await this.pushService.sendStreakWarning(
        streakRecord.userId,
        streakRecord.currentStreak,
      );
    }

    return atRiskStreaks.length;
  }
}
