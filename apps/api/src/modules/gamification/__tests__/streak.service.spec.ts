import { Test, TestingModule } from '@nestjs/testing';
import { StreakService } from '../streak.service';
import { XpService } from '../xp.service';
import { BadgeService } from '../badge.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { getLocalDateComponents } from '../timezone.util';

describe('StreakService (NEW-DATA-01 Timezone-Aware Streak Tracking)', () => {
  let service: StreakService;
  let prismaMock: any;
  let xpServiceMock: any;
  let badgeServiceMock: any;

  const mockUserId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(cb => cb(prismaMock)),
      userStreak: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    xpServiceMock = {
      awardXp: jest.fn(),
    };

    badgeServiceMock = {
      checkAndUnlockBadges: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: XpService, useValue: xpServiceMock },
        { provide: BadgeService, useValue: badgeServiceMock },
      ],
    }).compile();

    service = module.get<StreakService>(StreakService);
  });

  describe('Timezone-aware streak calculation', () => {
    it('creates initial streak record with 1 welcome freeze', async () => {
      prismaMock.userStreak.findUnique.mockResolvedValue(null);
      prismaMock.userStreak.create.mockResolvedValue({
        userId: mockUserId,
        currentStreak: 1,
        longestStreak: 1,
        streakFreezeCount: 1,
        totalReviews: 1,
      });

      const result = await service.recordActivity(mockUserId, 'Asia/Ho_Chi_Minh');

      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
      expect(result.streakIncreased).toBe(true);
      expect(prismaMock.userStreak.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUserId,
            currentStreak: 1,
            longestStreak: 1,
            streakFreezeCount: 1,
          }),
        }),
      );
      expect(badgeServiceMock.checkAndUnlockBadges).toHaveBeenCalledWith(
        mockUserId,
        'current_streak',
        1,
      );
    });

    it('handles multiple reviews on same day in UTC without increasing streak', async () => {
      const todayStr = getLocalDateComponents(new Date(), 'UTC').dateStr;

      prismaMock.userStreak.findUnique.mockResolvedValue({
        userId: mockUserId,
        currentStreak: 3,
        longestStreak: 5,
        lastReviewDate: new Date(`${todayStr}T00:00:00.000Z`),
        streakFreezeCount: 1,
      });

      prismaMock.userStreak.update.mockResolvedValue({
        userId: mockUserId,
        currentStreak: 3,
        longestStreak: 5,
      });

      const result = await service.recordActivity(mockUserId, 'UTC');

      expect(result.currentStreak).toBe(3);
      expect(result.streakIncreased).toBe(false);
      expect(prismaMock.userStreak.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: { totalReviews: { increment: 1 } },
      });
    });

    it('increments streak on consecutive day in UTC+7 (Asia/Ho_Chi_Minh)', async () => {
      const timezone = 'Asia/Ho_Chi_Minh';
      const todayComponents = getLocalDateComponents(new Date(), timezone);

      // Create yesterday in UTC+7
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayComponents = getLocalDateComponents(yesterdayDate, timezone);

      prismaMock.userStreak.findUnique.mockResolvedValue({
        userId: mockUserId,
        currentStreak: 6,
        longestStreak: 6,
        lastReviewDate: new Date(`${yesterdayComponents.dateStr}T00:00:00.000Z`),
        streakFreezeCount: 1,
      });

      prismaMock.userStreak.update.mockResolvedValue({
        userId: mockUserId,
        currentStreak: 7,
        longestStreak: 7,
      });

      const result = await service.recordActivity(mockUserId, timezone);

      expect(result.currentStreak).toBe(7);
      expect(result.longestStreak).toBe(7);
      expect(result.streakIncreased).toBe(true);

      // 7-day bonus awarded
      expect(xpServiceMock.awardXp).toHaveBeenCalledWith(
        mockUserId,
        100,
        expect.any(String),
        expect.stringContaining('7'),
      );
      expect(badgeServiceMock.checkAndUnlockBadges).toHaveBeenCalledWith(
        mockUserId,
        'current_streak',
        7,
      );
    });

    it('increments streak on consecutive day in UTC-5 (America/New_York)', async () => {
      const timezone = 'America/New_York';
      const todayComponents = getLocalDateComponents(new Date(), timezone);

      // Create yesterday in UTC-5
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayComponents = getLocalDateComponents(yesterdayDate, timezone);

      prismaMock.userStreak.findUnique.mockResolvedValue({
        userId: mockUserId,
        currentStreak: 2,
        longestStreak: 4,
        lastReviewDate: new Date(`${yesterdayComponents.dateStr}T00:00:00.000Z`),
        streakFreezeCount: 1,
      });

      prismaMock.userStreak.update.mockResolvedValue({
        userId: mockUserId,
        currentStreak: 3,
        longestStreak: 4,
      });

      const result = await service.recordActivity(mockUserId, timezone);

      expect(result.currentStreak).toBe(3);
      expect(result.longestStreak).toBe(4);
      expect(result.streakIncreased).toBe(true);
    });

    it('protects streak using streak freeze when missing 1 day (diff = 2)', async () => {
      const timezone = 'Asia/Ho_Chi_Minh';
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoComponents = getLocalDateComponents(twoDaysAgo, timezone);

      prismaMock.userStreak.findUnique.mockResolvedValue({
        userId: mockUserId,
        currentStreak: 5,
        longestStreak: 10,
        lastReviewDate: new Date(`${twoDaysAgoComponents.dateStr}T00:00:00.000Z`),
        streakFreezeCount: 1, // Has 1 shield
      });

      prismaMock.userStreak.update.mockResolvedValue({
        userId: mockUserId,
        currentStreak: 6,
        longestStreak: 10,
      });

      const result = await service.recordActivity(mockUserId, timezone);

      expect(result.currentStreak).toBe(6);
      expect(result.freezeUsed).toBe(true);
      expect(result.streakIncreased).toBe(true);
      expect(prismaMock.userStreak.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentStreak: 6,
            streakFreezeCount: { decrement: 1 },
            streakFreezeUsedToday: true,
          }),
        }),
      );
    });

    it('resets streak to 1 when missing days without streak freeze (diff > 1, freeze = 0)', async () => {
      const timezone = 'UTC';
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoComponents = getLocalDateComponents(threeDaysAgo, timezone);

      prismaMock.userStreak.findUnique.mockResolvedValue({
        userId: mockUserId,
        currentStreak: 15,
        longestStreak: 15,
        lastReviewDate: new Date(`${threeDaysAgoComponents.dateStr}T00:00:00.000Z`),
        streakFreezeCount: 0,
      });

      prismaMock.userStreak.update.mockResolvedValue({
        userId: mockUserId,
        currentStreak: 1,
        longestStreak: 15,
      });

      const result = await service.recordActivity(mockUserId, timezone);

      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(15);
      expect(result.streakIncreased).toBe(false);
      expect(result.freezeUsed).toBe(false);
    });
  });

  describe('useStreakFreeze', () => {
    it('successfully consumes a streak freeze inside transaction', async () => {
      prismaMock.userStreak.findUnique.mockResolvedValue({
        userId: mockUserId,
        streakFreezeCount: 2,
        streakFreezeUsedToday: false,
      });

      prismaMock.userStreak.update.mockResolvedValue({
        userId: mockUserId,
        streakFreezeCount: 1,
      });

      const result = await service.useStreakFreeze(mockUserId, 'Asia/Ho_Chi_Minh');

      expect(result.success).toBe(true);
      expect(result.remainingFreezes).toBe(1);
      expect(prismaMock.userStreak.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            streakFreezeCount: { decrement: 1 },
            streakFreezeUsedToday: true,
          }),
        }),
      );
    });

    it('fails when user has 0 streak freezes', async () => {
      prismaMock.userStreak.findUnique.mockResolvedValue({
        userId: mockUserId,
        streakFreezeCount: 0,
        streakFreezeUsedToday: false,
      });

      const result = await service.useStreakFreeze(mockUserId);

      expect(result.success).toBe(false);
      expect(result.remainingFreezes).toBe(0);
      expect(prismaMock.userStreak.update).not.toHaveBeenCalled();
    });
  });
});
