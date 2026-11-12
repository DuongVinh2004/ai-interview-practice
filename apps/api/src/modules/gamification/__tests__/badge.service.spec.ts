import { Test, TestingModule } from '@nestjs/testing';
import { BadgeService } from '../badge.service';
import { XpService } from '../xp.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('BadgeService (Plan C Gamification)', () => {
  let service: BadgeService;
  let prismaMock: any;
  let xpServiceMock: any;
  let eventEmitterMock: any;

  beforeEach(async () => {
    prismaMock = {
      badgeDefinition: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      userBadgeUnlock: {
        create: jest.fn(),
      },
    };

    xpServiceMock = {
      awardXp: jest.fn(),
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BadgeService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: XpService, useValue: xpServiceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<BadgeService>(BadgeService);
  });

  describe('checkAndUnlockBadges', () => {
    it('should unlock First Blood badge when completed interviews >= 1', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';

      prismaMock.badgeDefinition.findMany.mockResolvedValue([
        {
          id: 'badge-1',
          slug: 'first-blood',
          name: 'First Blood',
          nameVi: 'Khởi Đầu Nan',
          description: 'Desc',
          descriptionVi: 'Desc VI',
          iconUrl: '🎯',
          category: 'INTERVIEW',
          xpReward: 50,
          isSecret: false,
          criteria: { metric: 'completed_interviews', op: 'gte', value: 1 },
          unlocks: [],
        },
      ]);

      prismaMock.userBadgeUnlock.create.mockResolvedValue({
        id: 'unlock-1',
        userId,
        badgeId: 'badge-1',
        unlockedAt: new Date(),
      });

      const unlocked = await service.checkAndUnlockBadges(userId, 'completed_interviews', 1);

      expect(unlocked.length).toBe(1);
      expect(unlocked[0].slug).toBe('first-blood');
      expect(xpServiceMock.awardXp).toHaveBeenCalledWith(
        userId,
        50,
        expect.any(String),
        expect.stringContaining('Khởi Đầu Nan'),
      );
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'gamification.badge_unlocked',
        expect.objectContaining({ userId }),
      );
    });

    it('should unlock badge with eq operator (code_all_tests_passed)', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';

      prismaMock.badgeDefinition.findMany.mockResolvedValue([
        {
          id: 'badge-polyglot',
          slug: 'polyglot-coder',
          name: 'Code Wizard',
          nameVi: 'Phù Thủy Mã Nguồn',
          description: 'Desc',
          descriptionVi: 'Desc VI',
          iconUrl: '💻',
          category: 'CODING',
          xpReward: 50,
          isSecret: false,
          criteria: { metric: 'code_all_tests_passed', op: 'eq', value: true },
          unlocks: [],
        },
      ]);

      prismaMock.userBadgeUnlock.create.mockResolvedValue({
        id: 'unlock-2',
        userId,
        badgeId: 'badge-polyglot',
        unlockedAt: new Date(),
      });

      const unlocked = await service.checkAndUnlockBadges(userId, 'code_all_tests_passed', true);

      expect(unlocked.length).toBe(1);
      expect(unlocked[0].slug).toBe('polyglot-coder');
      expect(xpServiceMock.awardXp).toHaveBeenCalledWith(
        userId,
        50,
        expect.any(String),
        expect.stringContaining('Phù Thủy Mã Nguồn'),
      );
    });

    it('should unlock badge with between operator', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';

      prismaMock.badgeDefinition.findMany.mockResolvedValue([
        {
          id: 'badge-between',
          slug: 'score-master',
          name: 'Score Master',
          nameVi: 'Bậc Thầy Điểm Số',
          description: 'Score between 80 and 100',
          descriptionVi: 'Điểm từ 80 đến 100',
          iconUrl: '🌟',
          category: 'INTERVIEW',
          xpReward: 75,
          isSecret: false,
          criteria: { metric: 'overall_score', op: 'between', value: [80, 100] },
          unlocks: [],
        },
      ]);

      prismaMock.userBadgeUnlock.create.mockResolvedValue({
        id: 'unlock-3',
        userId,
        badgeId: 'badge-between',
        unlockedAt: new Date(),
      });

      const unlocked = await service.checkAndUnlockBadges(userId, 'overall_score', 85);
      expect(unlocked.length).toBe(1);
      expect(unlocked[0].slug).toBe('score-master');
    });

    it('should not unlock when criteria is not met or badge already unlocked', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';

      prismaMock.badgeDefinition.findMany.mockResolvedValue([
        {
          id: 'badge-streak-7',
          slug: 'streak-7',
          name: '7-Day Scholar',
          nameVi: 'Học Giả 7 Ngày',
          description: 'Desc',
          descriptionVi: 'Desc VI',
          iconUrl: '⚡',
          category: 'STREAK',
          xpReward: 100,
          isSecret: false,
          criteria: { metric: 'current_streak', op: 'gte', value: 7 },
          unlocks: [],
        },
        {
          id: 'badge-already-unlocked',
          slug: 'first-blood',
          name: 'First Blood',
          nameVi: 'Khởi Đầu Nan',
          description: 'Desc',
          descriptionVi: 'Desc VI',
          iconUrl: '🎯',
          category: 'INTERVIEW',
          xpReward: 50,
          isSecret: false,
          criteria: { metric: 'completed_interviews', op: 'gte', value: 1 },
          unlocks: [{ id: 'prev-unlock', unlockedAt: new Date() }],
        },
      ]);

      // Test value not meeting criteria (5 < 7)
      const unlockedFail = await service.checkAndUnlockBadges(userId, 'current_streak', 5);
      expect(unlockedFail.length).toBe(0);

      // Test already unlocked badge
      const unlockedAlready = await service.checkAndUnlockBadges(
        userId,
        'completed_interviews',
        10,
      );
      expect(unlockedAlready.length).toBe(0);
    });
  });
});
