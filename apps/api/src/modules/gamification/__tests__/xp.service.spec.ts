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
    it('should correctly calculate levels and thresholds based on formula 100 * Level^1.5', () => {
      // Level 1: 0 - 281 XP
      const lvl1 = service.calculateLevel(0);
      expect(lvl1.level).toBe(1);
      expect(lvl1.currentLevelMinXp).toBe(0);
      expect(lvl1.nextLevelXp).toBe(282);
      expect(lvl1.progressPercent).toBe(0);

      const lvl1Half = service.calculateLevel(141);
      expect(lvl1Half.level).toBe(1);
      expect(lvl1Half.progressPercent).toBe(50);

      // Level 2: 282 - 518 XP
      const lvl2 = service.calculateLevel(282);
      expect(lvl2.level).toBe(2);
      expect(lvl2.currentLevelMinXp).toBe(282);
      expect(lvl2.nextLevelXp).toBe(519);
      expect(lvl2.progressPercent).toBe(0);

      // Level 3: 519 - 799 XP
      const lvl3 = service.calculateLevel(519);
      expect(lvl3.level).toBe(3);
      expect(lvl3.currentLevelMinXp).toBe(519);
      expect(lvl3.nextLevelXp).toBe(800);

      // Level 5: 1118 XP
      const lvl5 = service.calculateLevel(1118);
      expect(lvl5.level).toBe(5);
      expect(lvl5.levelTitle).toBe('Senior Specialist');
      expect(lvl5.levelTitleVi).toBe('Chuyên viên Cấp cao');

      // Level 10: 3162 XP
      const lvl10 = service.calculateLevel(3162);
      expect(lvl10.level).toBe(10);

      // Level 50: 35355 XP
      const lvl50 = service.calculateLevel(35355);
      expect(lvl50.level).toBe(50);
    });
  });

  describe('awardXp', () => {
    it('should insert transaction, update user XP, and emit events on level up', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';

      prismaMock.xpTransaction.create.mockResolvedValue({
        id: 'tx-1',
        userId,
        amount: 300,
        source: XpSource.INTERVIEW_COMPLETE,
      });

      prismaMock.userXp.findUnique.mockResolvedValue({
        userId,
        totalXp: 0,
        currentLevel: 1,
      });

      prismaMock.userXp.upsert.mockResolvedValue({
        userId,
        totalXp: 300,
        currentLevel: 2,
      });

      const result = await service.awardXp(
        userId,
        300,
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
          amount: 300,
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
      prismaMock.userXp.upsert.mockResolvedValue({ totalXp: 20, currentLevel: 1 });

      const res = await service.claimDailyLogin(userId, 'Asia/Ho_Chi_Minh');
      expect(res.claimed).toBe(true);
      expect(res.xpAwarded).toBe(10);
      expect(prismaMock.xpTransaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should not award duplicate daily login XP on the same day', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      prismaMock.xpTransaction.findFirst.mockResolvedValue({ id: 'tx-today' });
      prismaMock.userXp.findUnique.mockResolvedValue({ totalXp: 10, currentLevel: 1 });

      const res = await service.claimDailyLogin(userId, 'America/New_York');
      expect(res.claimed).toBe(false);
      expect(res.xpAwarded).toBe(0);
    });
  });
});
