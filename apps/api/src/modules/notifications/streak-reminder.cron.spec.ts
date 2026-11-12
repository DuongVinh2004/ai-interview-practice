import { Test, TestingModule } from '@nestjs/testing';
import { StreakReminderCron } from './streak-reminder.cron';
import { PrismaService } from '../platform/prisma/prisma.service';
import { PushNotificationService } from './push-notification.service';
import { RedisService } from '../platform/redis/redis.service';

describe('StreakReminderCron (REL-003 Singleton Scheduler Locking)', () => {
  let cron: StreakReminderCron;
  let mockPrisma: any;
  let mockPushService: any;
  let mockRedis: any;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockPrisma = {
      userStreak: {
        findMany: jest.fn(),
      },
      notificationPreference: {
        findMany: jest.fn(),
      },
    };

    mockPushService = {
      sendStreakWarning: jest.fn().mockResolvedValue({ success: true }),
      sendDailyPracticeReminder: jest.fn().mockResolvedValue({ success: true }),
    };

    mockRedisClient = {
      set: jest.fn(),
    };

    mockRedis = {
      getClient: jest.fn(() => mockRedisClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreakReminderCron,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushNotificationService, useValue: mockPushService },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    cron = module.get<StreakReminderCron>(StreakReminderCron);
    jest.clearAllMocks();
  });

  it('acquires distributed lock, processes at-risk streaks in batches, and dispatches push warnings', async () => {
    // Redis SET NX EX returns OK when lock is acquired
    mockRedisClient.set.mockResolvedValue('OK');

    const dummyStreaks = [
      { userId: 'user-1', currentStreak: 5 },
      { userId: 'user-2', currentStreak: 12 },
    ];

    mockPrisma.userStreak.findMany
      .mockResolvedValueOnce(dummyStreaks) // Batch 1
      .mockResolvedValueOnce([]); // Batch 2 (empty -> terminates loop)

    await cron.handleDailyStreakReminders();

    expect(mockRedisClient.set).toHaveBeenCalledWith(
      expect.stringContaining('cron:lock:streak-reminder:'),
      expect.any(String),
      'EX',
      7200,
      'NX',
    );
    expect(mockPushService.sendStreakWarning).toHaveBeenCalledTimes(2);
    expect(mockPushService.sendStreakWarning).toHaveBeenCalledWith('user-1', 5);
    expect(mockPushService.sendStreakWarning).toHaveBeenCalledWith('user-2', 12);
  });

  it('skips execution on second replica when distributed lock is already held (single-replica guarantee)', async () => {
    // Redis SET NX EX returns null when key is already locked by another instance
    mockRedisClient.set.mockResolvedValue(null);

    await cron.handleDailyStreakReminders();

    expect(mockRedisClient.set).toHaveBeenCalled();
    expect(mockPrisma.userStreak.findMany).not.toHaveBeenCalled();
    expect(mockPushService.sendStreakWarning).not.toHaveBeenCalled();
  });

  it('falls back to process-local locking if Redis is not configured', async () => {
    const localCron = new StreakReminderCron(mockPrisma, mockPushService);

    mockPrisma.userStreak.findMany
      .mockResolvedValueOnce([{ userId: 'user-local', currentStreak: 3 }])
      .mockResolvedValueOnce([]);

    // First execution succeeds
    await localCron.handleDailyStreakReminders();
    expect(mockPushService.sendStreakWarning).toHaveBeenCalledTimes(1);

    // Second execution on same instance is skipped due to local lock
    await localCron.handleDailyStreakReminders();
    expect(mockPushService.sendStreakWarning).toHaveBeenCalledTimes(1);
  });

  it('sends daily practice reminders to users whose reminderTime matches the target hour', async () => {
    mockRedisClient.set.mockResolvedValue('OK');

    mockPrisma.notificationPreference.findMany.mockResolvedValue([
      { userId: 'user-pref-1', dailyReminder: true, reminderTime: '20:00' },
      { userId: 'user-pref-2', dailyReminder: true, reminderTime: '20:30' },
    ]);

    const sentCount = await cron.handleDailyPracticeReminders('20:00');

    expect(sentCount).toBe(2);
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      expect.stringContaining('cron:lock:practice-reminder:'),
      expect.any(String),
      'EX',
      3500,
      'NX',
    );
    expect(mockPushService.sendDailyPracticeReminder).toHaveBeenCalledTimes(2);
    expect(mockPushService.sendDailyPracticeReminder).toHaveBeenCalledWith('user-pref-1');
    expect(mockPushService.sendDailyPracticeReminder).toHaveBeenCalledWith('user-pref-2');
  });

  it('skips practice reminders if distributed lock is already held', async () => {
    mockRedisClient.set.mockResolvedValue(null);

    const sentCount = await cron.handleDailyPracticeReminders('08:00');

    expect(sentCount).toBe(0);
    expect(mockPrisma.notificationPreference.findMany).not.toHaveBeenCalled();
    expect(mockPushService.sendDailyPracticeReminder).not.toHaveBeenCalled();
  });

  it('triggers manual run and sends push warnings to all at-risk users', async () => {
    const atRiskUsers = [
      { userId: 'user-manual-1', currentStreak: 3 },
      { userId: 'user-manual-2', currentStreak: 10 },
    ];
    mockPrisma.userStreak.findMany.mockResolvedValue(atRiskUsers);

    const count = await cron.triggerManualRun();

    expect(count).toBe(2);
    expect(mockPushService.sendStreakWarning).toHaveBeenCalledWith('user-manual-1', 3);
    expect(mockPushService.sendStreakWarning).toHaveBeenCalledWith('user-manual-2', 10);
  });
});
