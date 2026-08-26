import { Test, TestingModule } from '@nestjs/testing';
import { GamificationController } from '../gamification.controller';
import { XpService } from '../xp.service';
import { BadgeService } from '../badge.service';
import { StreakService } from '../streak.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('GamificationController', () => {
  let controller: GamificationController;

  const mockXpService = {
    getGamificationProfile: jest.fn().mockResolvedValue({ totalXp: 120, level: 2 }),
    getLeaderboard: jest.fn().mockResolvedValue({ leaderboard: [] }),
    getHistory: jest.fn().mockResolvedValue({ history: [] }),
    claimDailyLogin: jest.fn().mockResolvedValue({ xpEarned: 10 }),
  };

  const mockBadgeService = {
    getAllBadges: jest.fn().mockResolvedValue({ badges: [] }),
  };

  const mockStreakService = {
    useStreakFreeze: jest.fn().mockResolvedValue({ success: true, remainingFreezes: 1 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamificationController],
      providers: [
        { provide: XpService, useValue: mockXpService },
        { provide: BadgeService, useValue: mockBadgeService },
        { provide: StreakService, useValue: mockStreakService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GamificationController>(GamificationController);
    jest.clearAllMocks();
  });

  it('correctly passes userId from CurrentUser decorator to getProfile', async () => {
    const result = await controller.getProfile('user-uuid-999');
    expect(mockXpService.getGamificationProfile).toHaveBeenCalledWith('user-uuid-999');
    expect(result).toEqual({ totalXp: 120, level: 2 });
  });

  it('correctly passes userId to claimDailyLogin', async () => {
    const result = await controller.claimDailyLogin('user-uuid-999');
    expect(mockXpService.claimDailyLogin).toHaveBeenCalledWith('user-uuid-999');
    expect(result).toEqual({ xpEarned: 10 });
  });

  it('correctly passes userId to useFreeze', async () => {
    const result = await controller.useFreeze('user-uuid-999');
    expect(mockStreakService.useStreakFreeze).toHaveBeenCalledWith('user-uuid-999');
    expect(result).toEqual({ success: true, remainingFreezes: 1 });
  });
});
