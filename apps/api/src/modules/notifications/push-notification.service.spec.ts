import { Test, TestingModule } from '@nestjs/testing';
import { PushNotificationService } from './push-notification.service';
import { PrismaService } from '../platform/prisma/prisma.service';

describe('PushNotificationService (SEC-011)', () => {
  let service: PushNotificationService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      pushSubscription: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn(),
      },
      notificationPreference: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PushNotificationService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<PushNotificationService>(PushNotificationService);
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  it('should remain disabled without VAPID keys in development mode', () => {
    process.env.NODE_ENV = 'development';
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

  it('should subscribe user endpoint properly', async () => {
    prismaMock.pushSubscription.upsert.mockResolvedValue({ id: 'sub-1' });

    const result = await service.subscribe('user-1', {
      endpoint: 'https://push.example.com/sub/123',
      keys: { p256dh: 'key-1', auth: 'auth-1' },
      device: 'Chrome Desktop',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('sub-1');
  });
});
