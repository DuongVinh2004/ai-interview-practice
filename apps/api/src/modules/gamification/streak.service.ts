import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { XpService } from './xp.service';
import { BadgeService } from './badge.service';
import { XpSource } from '@ai-interview/contracts';

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly xpService: XpService,
    private readonly badgeService: BadgeService,
  ) {}

  async recordActivity(userId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
    streakIncreased: boolean;
    freezeUsed: boolean;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingStreak = await this.prisma.userStreak.findUnique({
      where: { userId },
    });

    if (!existingStreak) {
      const created = await this.prisma.userStreak.create({
        data: {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          lastReviewDate: today,
          totalReviews: 1,
          streakFreezeCount: 1, // Welcome 1 freeze shield
        },
      });

      await this.badgeService.checkAndUnlockBadges(userId, 'current_streak', 1);

      return {
        currentStreak: 1,
        longestStreak: 1,
        streakIncreased: true,
        freezeUsed: false,
      };
    }

    if (existingStreak.lastReviewDate) {
      const lastDate = new Date(existingStreak.lastReviewDate);
      lastDate.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - lastDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Already practiced today
        const updated = await this.prisma.userStreak.update({
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
        };
      }

      if (diffDays === 1) {
        // Consecutive day streak increase!
        const newStreak = existingStreak.currentStreak + 1;
        const newLongest = Math.max(existingStreak.longestStreak, newStreak);

        const updated = await this.prisma.userStreak.update({
          where: { userId },
          data: {
            currentStreak: newStreak,
            longestStreak: newLongest,
            lastReviewDate: today,
            totalReviews: { increment: 1 },
            streakFreezeUsedToday: false,
          },
        });

        // Weekly streak bonus
        if (newStreak % 7 === 0) {
          await this.xpService.awardXp(
            userId,
            100,
            XpSource.STREAK_BONUS,
            `Thưởng chuỗi học tập ${newStreak} ngày / ${newStreak}-Day Streak Bonus!`,
          );
        }

        await this.badgeService.checkAndUnlockBadges(userId, 'current_streak', newStreak);

        return {
          currentStreak: newStreak,
          longestStreak: newLongest,
          streakIncreased: true,
          freezeUsed: false,
        };
      }

      if (diffDays === 2 && existingStreak.streakFreezeCount > 0) {
        // Missed yesterday but had a Streak Freeze!
        const newStreak = existingStreak.currentStreak + 1;
        const newLongest = Math.max(existingStreak.longestStreak, newStreak);

        const updated = await this.prisma.userStreak.update({
          where: { userId },
          data: {
            currentStreak: newStreak,
            longestStreak: newLongest,
            lastReviewDate: today,
            totalReviews: { increment: 1 },
            streakFreezeCount: { decrement: 1 },
            streakFreezeUsedToday: true,
            freezeLastUsedAt: new Date(),
          },
        });

        this.logger.log(`Streak freeze protected streak for user ${userId}`);

        return {
          currentStreak: newStreak,
          longestStreak: newLongest,
          streakIncreased: true,
          freezeUsed: true,
        };
      }

      // Missed more than allowed -> Reset streak
      const updated = await this.prisma.userStreak.update({
        where: { userId },
        data: {
          currentStreak: 1,
          lastReviewDate: today,
          totalReviews: { increment: 1 },
          streakFreezeUsedToday: false,
        },
      });

      return {
        currentStreak: 1,
        longestStreak: updated.longestStreak,
        streakIncreased: false,
        freezeUsed: false,
      };
    }

    // First time lastReviewDate set
    const updated = await this.prisma.userStreak.update({
      where: { userId },
      data: {
        currentStreak: 1,
        longestStreak: Math.max(existingStreak.longestStreak, 1),
        lastReviewDate: today,
        totalReviews: { increment: 1 },
      },
    });

    return {
      currentStreak: 1,
      longestStreak: updated.longestStreak,
      streakIncreased: true,
      freezeUsed: false,
    };
  }

  async useStreakFreeze(userId: string): Promise<{ success: boolean; remainingFreezes: number }> {
    const streak = await this.prisma.userStreak.findUnique({ where: { userId } });
    if (!streak || streak.streakFreezeCount <= 0) {
      return { success: false, remainingFreezes: streak?.streakFreezeCount || 0 };
    }

    const updated = await this.prisma.userStreak.update({
      where: { userId },
      data: {
        streakFreezeCount: { decrement: 1 },
        streakFreezeUsedToday: true,
        freezeLastUsedAt: new Date(),
      },
    });

    return { success: true, remainingFreezes: updated.streakFreezeCount };
  }
}
