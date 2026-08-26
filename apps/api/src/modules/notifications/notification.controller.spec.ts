import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { PushNotificationService } from './push-notification.service';
import { StreakReminderCron } from './streak-reminder.cron';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MfaStepUpGuard } from '../auth/guards/mfa-step-up.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';

describe('NotificationController', () => {
  let controller: NotificationController;
  let pushService: PushNotificationService;
  let streakCron: StreakReminderCron;

  const mockPushService = {
    getPreferences: jest.fn().mockResolvedValue({ emailEnabled: true, pushEnabled: true }),
    updatePreferences: jest.fn().mockResolvedValue({ emailEnabled: false, pushEnabled: true }),
    subscribe: jest.fn().mockResolvedValue({ success: true }),
    unsubscribe: jest.fn().mockResolvedValue({ success: true }),
    sendToUser: jest.fn().mockResolvedValue(true),
  };

  const mockStreakCron = {
    triggerManualRun: jest.fn().mockResolvedValue(42),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        Reflector,
        { provide: PushNotificationService, useValue: mockPushService },
        { provide: StreakReminderCron, useValue: mockStreakCron },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(MfaStepUpGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotificationController>(NotificationController);
    pushService = module.get<PushNotificationService>(PushNotificationService);
    streakCron = module.get<StreakReminderCron>(StreakReminderCron);
    jest.clearAllMocks();
  });

  it('correctly passes userId from CurrentUser decorator to getPreferences', async () => {
    const userId = 'user-uuid-123';
    const result = await controller.getPreferences(userId);
    expect(pushService.getPreferences).toHaveBeenCalledWith('user-uuid-123');
    expect(result).toEqual({ emailEnabled: true, pushEnabled: true });
  });

  it('correctly passes userId to updatePreferences', async () => {
    const userId = 'user-uuid-123';
    const dto = { emailEnabled: false, pushEnabled: true };
    const result = await controller.updatePreferences(userId, dto as any);
    expect(pushService.updatePreferences).toHaveBeenCalledWith('user-uuid-123', dto);
    expect(result).toEqual({ emailEnabled: false, pushEnabled: true });
  });

  it('correctly executes triggerStreakCheck and returns count', async () => {
    const result = await controller.triggerStreakCheck();
    expect(streakCron.triggerManualRun).toHaveBeenCalled();
    expect(result).toEqual({ triggeredCount: 42 });
  });
});
