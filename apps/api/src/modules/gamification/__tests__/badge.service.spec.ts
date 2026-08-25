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
  });
});
