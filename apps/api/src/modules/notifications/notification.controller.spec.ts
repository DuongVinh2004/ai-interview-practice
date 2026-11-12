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
    handleDailyPracticeReminders: jest.fn().mockResolvedValue(5),
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

  it('correctly executes triggerPracticeReminder and returns count', async () => {
    const result = await controller.triggerPracticeReminder({ time: '20:00' });
    expect(streakCron.handleDailyPracticeReminders).toHaveBeenCalledWith('20:00');
    expect(result).toEqual({ triggeredCount: 5 });
  });

  it('correctly passes subscription payload to pushService.subscribe on POST /notifications/subscribe', async () => {
    const userId = 'user-uuid-123';
    const dto = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-token',
      keys: { p256dh: 'p256-test-key', auth: 'auth-test-key' },
      device: 'Desktop Chrome',
    };
    const result = await controller.subscribeDirect(userId, dto);
    expect(pushService.subscribe).toHaveBeenCalledWith('user-uuid-123', dto);
    expect(result).toEqual({ success: true });
  });

  it('correctly passes subscription payload on POST /notifications/push/subscribe fallback', async () => {
    const userId = 'user-uuid-123';
    const dto = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-token-2',
      keys: { p256dh: 'p256-test-key-2', auth: 'auth-test-key-2' },
    };
    const result = await controller.subscribe(userId, dto);
    expect(pushService.subscribe).toHaveBeenCalledWith('user-uuid-123', dto);
    expect(result).toEqual({ success: true });
  });

  it('correctly passes endpoint to pushService.unsubscribe', async () => {
    const body = { endpoint: 'https://fcm.googleapis.com/fcm/send/test-token' };
    const result = await controller.unsubscribeDirect(body);
    expect(pushService.unsubscribe).toHaveBeenCalledWith(body.endpoint);
    expect(result).toEqual({ success: true });
  });

  it('correctly sends test push notification with welcome payload', async () => {
    const userId = 'user-uuid-123';
    await controller.sendTestPush(userId);
    expect(pushService.sendToUser).toHaveBeenCalledWith(
      'user-uuid-123',
      expect.objectContaining({
        title: expect.stringContaining('Thông báo thử nghiệm'),
        url: '/dashboard',
      }),
    );
  });
});
