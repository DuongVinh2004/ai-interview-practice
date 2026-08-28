import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { XpService } from './xp.service';
import { BadgeService } from './badge.service';
import { XpSource } from '@ai-interview/contracts';
import { getLocalDateComponents, calculateDayDifference } from './timezone.util';

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly xpService: XpService,
    private readonly badgeService: BadgeService,
  ) {}

  async recordActivity(
    userId: string,
    timezone?: string,
  ): Promise<{
    currentStreak: number;
    longestStreak: number;
    streakIncreased: boolean;
    freezeUsed: boolean;
  }> {
    const todayComponents = getLocalDateComponents(new Date(), timezone);
    const todayDateObj = new Date(`${todayComponents.dateStr}T00:00:00.000Z`);

    const result = await this.prisma.$transaction(async tx => {
      const existingStreak = await tx.userStreak.findUnique({
        where: { userId },
      });

      if (!existingStreak) {
        const created = await tx.userStreak.create({
          data: {
            userId,
            currentStreak: 1,
            longestStreak: 1,
            lastReviewDate: todayDateObj,
            totalReviews: 1,
            streakFreezeCount: 1, // Welcome 1 freeze shield
          },
        });

        return {
          currentStreak: created.currentStreak,
          longestStreak: created.longestStreak,
          streakIncreased: true,
          freezeUsed: false,
          isNewRecord: true,
          newStreakForBadges: 1,
        };
      }

      if (existingStreak.lastReviewDate) {
        const diffDays = calculateDayDifference(
          todayComponents.dateStr,
          existingStreak.lastReviewDate,
          timezone,
        );

        if (diffDays === 0) {
          // Already practiced today in candidate's local timezone
          const updated = await tx.userStreak.update({
            where: { userId },
            data: {
              totalReviews: { increment: 1 },
            },
          });
          return {
            currentStreak: updated.currentStreak,
            longestStreak: updated.longestStreak,
            streakIncreased: false,
            freezeUsed: false,
            isNewRecord: false,
            newStreakForBadges: 0,
          };
        }

        if (diffDays === 1) {
          // Consecutive day streak increase in candidate's local timezone!
          const newStreak = existingStreak.currentStreak + 1;
          const newLongest = Math.max(existingStreak.longestStreak, newStreak);

          const updated = await tx.userStreak.update({
            where: { userId },
            data: {
              currentStreak: newStreak,
              longestStreak: newLongest,
              lastReviewDate: todayDateObj,
              totalReviews: { increment: 1 },
              streakFreezeUsedToday: false,
            },
          });

          return {
            currentStreak: updated.currentStreak,
            longestStreak: updated.longestStreak,
            streakIncreased: true,
            freezeUsed: false,
            isNewRecord: false,
            newStreakForBadges: newStreak,
          };
        }

        if (diffDays === 2 && existingStreak.streakFreezeCount > 0) {
          // Missed yesterday in local timezone but had a Streak Freeze!
          const newStreak = existingStreak.currentStreak + 1;
          const newLongest = Math.max(existingStreak.longestStreak, newStreak);

          const updated = await tx.userStreak.update({
            where: { userId },
            data: {
              currentStreak: newStreak,
              longestStreak: newLongest,
              lastReviewDate: todayDateObj,
              totalReviews: { increment: 1 },
              streakFreezeCount: { decrement: 1 },
              streakFreezeUsedToday: true,
              freezeLastUsedAt: new Date(),
            },
          });

          return {
            currentStreak: updated.currentStreak,
            longestStreak: updated.longestStreak,
            streakIncreased: true,
            freezeUsed: true,
            isNewRecord: false,
            newStreakForBadges: newStreak,
          };
        }

        // Missed more than allowed in local timezone -> Reset streak
        const updated = await tx.userStreak.update({
          where: { userId },
          data: {
            currentStreak: 1,
            lastReviewDate: todayDateObj,
            totalReviews: { increment: 1 },
            streakFreezeUsedToday: false,
          },
        });

        return {
          currentStreak: 1,
          longestStreak: updated.longestStreak,
          streakIncreased: false,
          freezeUsed: false,
          isNewRecord: false,
          newStreakForBadges: 0,
        };
      }

      // First time lastReviewDate set
      const updated = await tx.userStreak.update({
        where: { userId },
        data: {
          currentStreak: 1,
          longestStreak: Math.max(existingStreak.longestStreak, 1),
          lastReviewDate: todayDateObj,
          totalReviews: { increment: 1 },
        },
      });

      return {
        currentStreak: 1,
        longestStreak: updated.longestStreak,
        streakIncreased: true,
        freezeUsed: false,
        isNewRecord: false,
        newStreakForBadges: 1,
      };
    });

    if (result.freezeUsed) {
      this.logger.log(`Streak freeze protected streak for user ${userId}`);
    }

    if (result.newStreakForBadges > 0) {
      // Weekly streak bonus
      if (result.newStreakForBadges % 7 === 0) {
        await this.xpService.awardXp(
          userId,
          100,
          XpSource.STREAK_BONUS,
          `Thưởng chuỗi học tập ${result.newStreakForBadges} ngày / ${result.newStreakForBadges}-Day Streak Bonus!`,
        );
      }

      await this.badgeService.checkAndUnlockBadges(
        userId,
        'current_streak',
        result.newStreakForBadges,
      );
    }

    return {
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      streakIncreased: result.streakIncreased,
      freezeUsed: result.freezeUsed,
    };
  }

  async useStreakFreeze(
    userId: string,
    timezone?: string,
  ): Promise<{ success: boolean; remainingFreezes: number }> {
    return this.prisma.$transaction(async tx => {
      const streak = await tx.userStreak.findUnique({ where: { userId } });
      if (!streak || streak.streakFreezeCount <= 0 || streak.streakFreezeUsedToday) {
        return { success: false, remainingFreezes: streak?.streakFreezeCount || 0 };
      }

      const updated = await tx.userStreak.update({
        where: { userId },
        data: {
          streakFreezeCount: { decrement: 1 },
          streakFreezeUsedToday: true,
          freezeLastUsedAt: new Date(),
        },
      });

      return { success: true, remainingFreezes: updated.streakFreezeCount };
    });
  }
}
