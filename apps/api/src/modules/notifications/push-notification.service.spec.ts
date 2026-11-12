import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushNotificationService } from './push-notification.service';
import { PrismaService } from '../platform/prisma/prisma.service';

jest.mock('web-push', () => {
  const actual = jest.requireActual('web-push');
  return {
    ...actual,
    sendNotification: jest.fn(),
  };
});

const VALID_VAPID_PUBLIC =
  'BHzqXbiPKRK7M7L7imPhPBA6UOXlZ9SuYVJt5HerKrGUn2G1QqpvnP91V7biQhQDwTWBBwQ4JzXjabWPeXWtaMA';
const VALID_VAPID_PRIVATE = 'RhRDhsqsmRMQIoeM4Hyd0OQhW0VhCZqKU3EYX4yU2To';

describe('PushNotificationService (SEC-011 & C5 Delivery)', () => {
  let service: PushNotificationService;
  let prismaMock: any;
  let configServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      pushSubscription: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({}),
      },
      notificationPreference: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    configServiceMock = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'vapid.publicKey' || key === 'VAPID_PUBLIC_KEY')
          return process.env.VAPID_PUBLIC_KEY;
        if (key === 'vapid.privateKey' || key === 'VAPID_PRIVATE_KEY')
          return process.env.VAPID_PRIVATE_KEY;
        if (key === 'vapid.subject' || key === 'VAPID_SUBJECT') return process.env.VAPID_SUBJECT;
        if (key === 'app.nodeEnv' || key === 'NODE_ENV') return process.env.NODE_ENV;
        return defaultVal;
      }),
    };

    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<PushNotificationService>(PushNotificationService);
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
    jest.restoreAllMocks();
  });

  it('should remain disabled without VAPID keys in development mode', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    service.initVapid();
    expect(service.getIsConfigured()).toBe(false);
  });

  it('should fail-closed and disable VAPID when running in production with demo keys (SEC-011)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    service.initVapid();
    expect(service.getIsConfigured()).toBe(false);
  });

  it('should fail-closed in production when VAPID keys are invalid (SEC-011)', () => {
    process.env.NODE_ENV = 'production';
    process.env.VAPID_PUBLIC_KEY = 'invalid-public-key';
    process.env.VAPID_PRIVATE_KEY = 'invalid-private-key';

    service.initVapid();
    expect(service.getIsConfigured()).toBe(false);
  });

  it('should initialize VAPID successfully when valid keys are provided via ConfigService', () => {
    process.env.NODE_ENV = 'production';
    process.env.VAPID_PUBLIC_KEY = VALID_VAPID_PUBLIC;
    process.env.VAPID_PRIVATE_KEY = VALID_VAPID_PRIVATE;

    service.initVapid();
    expect(service.getIsConfigured()).toBe(true);
    expect(configServiceMock.get).toHaveBeenCalledWith('vapid.publicKey');
    expect(configServiceMock.get).toHaveBeenCalledWith('vapid.privateKey');
  });

  it('should subscribe user endpoint properly with database upsert verification', async () => {
    prismaMock.pushSubscription.upsert.mockResolvedValue({ id: 'sub-1' });

    const result = await service.subscribe('user-1', {
      endpoint: 'https://push.example.com/sub/123',
      keys: { p256dh: 'key-1', auth: 'auth-1' },
      device: 'Chrome Desktop',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('sub-1');
    expect(prismaMock.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example.com/sub/123' },
      create: {
        userId: 'user-1',
        endpoint: 'https://push.example.com/sub/123',
        p256dh: 'key-1',
        auth: 'auth-1',
        device: 'Chrome Desktop',
      },
      update: {
        userId: 'user-1',
        p256dh: 'key-1',
        auth: 'auth-1',
        device: 'Chrome Desktop',
      },
    });
  });

  it('should deliver real push notification via web-push and verify payload format', async () => {
    process.env.VAPID_PUBLIC_KEY = VALID_VAPID_PUBLIC;
    process.env.VAPID_PRIVATE_KEY = VALID_VAPID_PRIVATE;
    service.initVapid();
    expect(service.getIsConfigured()).toBe(true);

    prismaMock.pushSubscription.findMany.mockResolvedValue([
      {
        id: 'sub-db-1',
        userId: 'user-123',
        endpoint: 'https://push.services.mozilla.com/v1/sub/456',
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0A3qc7wW2_TJ1-G_wG_hO80_i',
        auth: 'tBHItJI5svbpqma0QA',
      },
    ]);

    const sendSpy = (webpush.sendNotification as jest.Mock).mockResolvedValue({
      statusCode: 201,
      headers: {},
      body: '',
    });

    const result = await service.sendToUser('user-123', {
      title: 'Nhắc nhở luyện tập',
      body: 'Đã đến giờ ôn tập flashcard!',
      url: '/practice',
    });

    expect(result.sentCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(sendSpy).toHaveBeenCalledTimes(1);

    const [subscriptionArg, payloadStringArg] = sendSpy.mock.calls[0];
    expect(subscriptionArg).toEqual({
      endpoint: 'https://push.services.mozilla.com/v1/sub/456',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0A3qc7wW2_TJ1-G_wG_hO80_i',
        auth: 'tBHItJI5svbpqma0QA',
      },
    });

    const parsedPayload = JSON.parse(payloadStringArg as string);
    expect(parsedPayload).toEqual(
      expect.objectContaining({
        title: 'Nhắc nhở luyện tập',
        body: 'Đã đến giờ ôn tập flashcard!',
        url: '/practice',
      }),
    );
  });

  it('should auto-delete expired subscription (HTTP 410 Gone) from DB', async () => {
    process.env.VAPID_PUBLIC_KEY = VALID_VAPID_PUBLIC;
    process.env.VAPID_PRIVATE_KEY = VALID_VAPID_PRIVATE;
    service.initVapid();

    prismaMock.pushSubscription.findMany.mockResolvedValue([
      {
        id: 'sub-expired-410',
        userId: 'user-expired',
        endpoint: 'https://fcm.googleapis.com/fcm/send/expired-token',
        p256dh: 'p256',
        auth: 'auth',
      },
    ]);

    const goneError: any = new Error('Subscription expired');
    goneError.statusCode = 410;
    (webpush.sendNotification as jest.Mock).mockRejectedValue(goneError);

    const result = await service.sendToUser('user-expired', {
      title: 'Test',
      body: 'Test Expired',
    });

    expect(result.sentCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({
      where: { id: 'sub-expired-410' },
    });
  });

  it('should auto-delete not found subscription (HTTP 404 Not Found) from DB', async () => {
    process.env.VAPID_PUBLIC_KEY = VALID_VAPID_PUBLIC;
    process.env.VAPID_PRIVATE_KEY = VALID_VAPID_PRIVATE;
    service.initVapid();

    prismaMock.pushSubscription.findMany.mockResolvedValue([
      {
        id: 'sub-not-found-404',
        userId: 'user-not-found',
        endpoint: 'https://fcm.googleapis.com/fcm/send/not-found-token',
        p256dh: 'p256',
        auth: 'auth',
      },
    ]);

    const notFoundError: any = new Error('Subscription not found');
    notFoundError.statusCode = 404;
    (webpush.sendNotification as jest.Mock).mockRejectedValue(notFoundError);

    const result = await service.sendToUser('user-not-found', {
      title: 'Test',
      body: 'Test Not Found',
    });

    expect(result.sentCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({
      where: { id: 'sub-not-found-404' },
    });
  });

  it('should send streak warning with proper streak count and url', async () => {
    const sendToUserSpy = jest
      .spyOn(service, 'sendToUser')
      .mockResolvedValue({ sentCount: 1, failedCount: 0 });

    await service.sendStreakWarning('user-123', 5);

    expect(sendToUserSpy).toHaveBeenCalledWith('user-123', {
      title: '🔥 Giữ vững chuỗi ngày học tập!',
      body: expect.stringContaining('5 ngày'),
      url: '/flashcards',
    });
  });

  it('should send daily practice reminder with proper payload', async () => {
    const sendToUserSpy = jest
      .spyOn(service, 'sendToUser')
      .mockResolvedValue({ sentCount: 1, failedCount: 0 });

    await service.sendDailyPracticeReminder('user-123');

    expect(sendToUserSpy).toHaveBeenCalledWith('user-123', {
      title: '⏰ Đến giờ luyện tập hôm nay!',
      body: expect.stringContaining('flashcard'),
      url: '/flashcards',
    });
  });
});
