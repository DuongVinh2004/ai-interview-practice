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
    };

    mockPushService = {
      sendStreakWarning: jest.fn().mockResolvedValue({ success: true }),
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
});
