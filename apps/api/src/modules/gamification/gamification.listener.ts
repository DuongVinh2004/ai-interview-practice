import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { XpService } from './xp.service';
import { BadgeService } from './badge.service';
import { StreakService } from './streak.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { XpSource } from '@ai-interview/contracts';

@Injectable()
export class GamificationEventListener {
  private readonly logger = new Logger(GamificationEventListener.name);

  constructor(
    private readonly xpService: XpService,
    private readonly badgeService: BadgeService,
    private readonly streakService: StreakService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('interview.completed')
  async handleInterviewCompleted(payload: {
    userId: string;
    sessionId: string;
    overallScore: number;
    sessionMode?: string;
  }) {
    try {
      this.logger.log(
        `Handling interview.completed event for user ${payload.userId} (Score: ${payload.overallScore})`,
      );

      // 1. Calculate XP (+50 base, +20 bonus for score >= 8.0)
      const baseAmount = 50;
      const bonus = payload.overallScore >= 8.0 ? 20 : 0;
      const totalAmount = baseAmount + bonus;

      const desc =
        bonus > 0
          ? `Hoàn thành phỏng vấn (Điểm cao ${payload.overallScore}/10 + Thưởng)`
          : `Hoàn thành buổi phỏng vấn (Điểm ${payload.overallScore}/10)`;

      await this.xpService.awardXp(
        payload.userId,
        totalAmount,
        XpSource.INTERVIEW_COMPLETE,
        desc,
      );

      // 2. Update Streak
      await this.streakService.recordActivity(payload.userId);

      // 3. Check Badge criteria
      const count = await this.prisma.interviewSession.count({
        where: {
          userId: payload.userId,
          state: 'COMPLETED' as any,
        },
      });

      await this.badgeService.checkAndUnlockBadges(payload.userId, 'completed_interviews', count);
    } catch (err: any) {
      this.logger.error(`Error processing interview.completed gamification: ${err.message}`);
    }
  }

  @OnEvent('evaluation.completed')
  async handleEvaluationCompleted(payload: {
    userId: string;
    sessionId: string;
    turnNumber: number;
    score: number;
    sessionMode?: string;
  }) {
    try {
      if (payload.score >= 10.0) {
        await this.badgeService.checkAndUnlockBadges(
          payload.userId,
          'single_turn_score',
          payload.score,
        );
      }

      if (payload.sessionMode === 'BEHAVIORAL') {
        await this.xpService.awardXp(
          payload.userId,
          20,
          XpSource.STAR_COMPLETE,
          `Đánh giá câu trả lời STAR - Vòng ${payload.turnNumber}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Error processing evaluation.completed gamification: ${err.message}`);
    }
  }

  @OnEvent('flashcard.reviewed')
  async handleFlashcardReviewed(payload: {
    userId: string;
    cardId: string;
    rating: number;
  }) {
    try {
      // Award 2 XP per review (max 200 XP per day handled via daily logic)
      await this.xpService.awardXp(
        payload.userId,
        2,
        XpSource.FLASHCARD_REVIEW,
        'Ôn tập Flashcard Active Recall',
      );

      const streakResult = await this.streakService.recordActivity(payload.userId);

      // Count total reviews
      const totalReviews = await this.prisma.reviewLog.count({
        where: {
          flashcard: {
            deck: {
              userId: payload.userId,
            },
          },
        },
      });

      await this.badgeService.checkAndUnlockBadges(
        payload.userId,
        'total_flashcard_reviews',
        totalReviews,
      );
    } catch (err: any) {
      this.logger.error(`Error processing flashcard.reviewed gamification: ${err.message}`);
    }
  }

  @OnEvent('code.executed')
  async handleCodeExecuted(payload: {
    userId: string;
    allTestsPassed: boolean;
    language?: string;
  }) {
    try {
      if (payload.allTestsPassed) {
        await this.xpService.awardXp(
          payload.userId,
          30,
          XpSource.CODING_SUBMIT,
          `Hoàn thành giải thuật kiểm thử thành công (${payload.language || 'Sandbox'})`,
        );

        await this.badgeService.checkAndUnlockBadges(
          payload.userId,
          'code_all_tests_passed',
          true,
        );

        await this.streakService.recordActivity(payload.userId);
      }
    } catch (err: any) {
      this.logger.error(`Error processing code.executed gamification: ${err.message}`);
    }
  }
}
