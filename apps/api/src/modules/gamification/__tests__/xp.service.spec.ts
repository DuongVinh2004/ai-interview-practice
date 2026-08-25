import { Test, TestingModule } from '@nestjs/testing';
import { XpService } from '../xp.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { XpSource } from '@ai-interview/contracts';

describe('XpService (Plan C Gamification)', () => {
  let service: XpService;
  let prismaMock: any;
  let eventEmitterMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(cb => cb(prismaMock)),
      xpTransaction: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      userXp: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      userStreak: {
        findUnique: jest.fn(),
      },
      badgeDefinition: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XpService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<XpService>(XpService);
  });

  describe('calculateLevel', () => {
    it('should correctly calculate levels and thresholds based on formula', () => {
      // Level 1: 0 - 99 XP
      const lvl1 = service.calculateLevel(0);
      expect(lvl1.level).toBe(1);
      expect(lvl1.currentLevelMinXp).toBe(0);
      expect(lvl1.nextLevelXp).toBe(100);
      expect(lvl1.progressPercent).toBe(0);

      const lvl1Half = service.calculateLevel(50);
      expect(lvl1Half.level).toBe(1);
      expect(lvl1Half.progressPercent).toBe(50);

      // Level 2: 100 - 399 XP
      const lvl2 = service.calculateLevel(100);
      expect(lvl2.level).toBe(2);
      expect(lvl2.currentLevelMinXp).toBe(100);
      expect(lvl2.nextLevelXp).toBe(400);
      expect(lvl2.progressPercent).toBe(0);

      const lvl2Mid = service.calculateLevel(250);
      expect(lvl2Mid.level).toBe(2);
      expect(lvl2Mid.progressPercent).toBe(50);

      // Level 3: 400 - 899 XP
      const lvl3 = service.calculateLevel(400);
      expect(lvl3.level).toBe(3);
      expect(lvl3.currentLevelMinXp).toBe(400);
      expect(lvl3.nextLevelXp).toBe(900);

      // Level 5: 1600 XP
      const lvl5 = service.calculateLevel(1600);
      expect(lvl5.level).toBe(5);
      expect(lvl5.levelTitle).toBe('Senior Specialist');
      expect(lvl5.levelTitleVi).toBe('Chuyên viên Cấp cao');
    });
  });

  describe('awardXp', () => {
    it('should insert transaction, update user XP, and emit events on level up', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';

      prismaMock.xpTransaction.create.mockResolvedValue({
        id: 'tx-1',
        userId,
        amount: 150,
        source: XpSource.INTERVIEW_COMPLETE,
      });

      prismaMock.userXp.findUnique.mockResolvedValue({
        userId,
        totalXp: 0,
        currentLevel: 1,
      });

      prismaMock.userXp.upsert.mockResolvedValue({
        userId,
        totalXp: 150,
        currentLevel: 2,
      });

      const result = await service.awardXp(
        userId,
        150,
        XpSource.INTERVIEW_COMPLETE,
        'Completed Interview',
      );

      expect(result.isLevelUp).toBe(true);
      expect(result.oldLevel).toBe(1);
      expect(result.newLevel).toBe(2);
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'gamification.xp_awarded',
        expect.objectContaining({
          userId,
          amount: 150,
          isLevelUp: true,
        }),
      );
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'gamification.level_up',
        expect.objectContaining({
          userId,
          oldLevel: 1,
          newLevel: 2,
        }),
      );
    });
  });

  describe('claimDailyLogin', () => {
    it('should award daily XP if not claimed today', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      prismaMock.xpTransaction.findFirst.mockResolvedValue(null);
      prismaMock.userXp.findUnique.mockResolvedValue({ totalXp: 10, currentLevel: 1 });

      const res = await service.claimDailyLogin(userId);
      expect(res.claimed).toBe(true);
      expect(res.xpAwarded).toBe(10);
    });

    it('should not award duplicate daily login XP on the same day', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      prismaMock.xpTransaction.findFirst.mockResolvedValue({ id: 'tx-today' });
      prismaMock.userXp.findUnique.mockResolvedValue({ totalXp: 10, currentLevel: 1 });

      const res = await service.claimDailyLogin(userId);
      expect(res.claimed).toBe(false);
      expect(res.xpAwarded).toBe(0);
    });
  });
});
