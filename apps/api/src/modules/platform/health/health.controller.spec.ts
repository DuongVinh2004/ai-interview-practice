import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HttpStatus } from '@nestjs/common';

describe('HealthController (OPS-002 Liveness & Readiness Probes)', () => {
  let controller: HealthController;
  let mockPrisma: any;
  let mockRedis: any;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };

    mockRedisClient = {
      ping: jest.fn().mockResolvedValue('PONG'),
    };

    mockRedis = {
      getClient: jest.fn(() => mockRedisClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns status ok for liveness probe (/health/live)', () => {
    const res = controller.getLive();
    expect(res.status).toBe('ok');
    expect(res.timestamp).toBeDefined();
  });

  it('returns 200 OK when database and redis are healthy (/health/ready)', async () => {
    const resMock: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.getReady(resMock);

    expect(resMock.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(resMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        checks: { database: 'up', redis: 'up' },
      }),
    );
  });

  it('returns 503 Service Unavailable when database check fails (/health/ready)', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection lost'));

    const resMock: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.getReady(resMock);

    expect(resMock.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(resMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        checks: { database: 'down', redis: 'up' },
      }),
    );
  });

  it('returns 503 Service Unavailable when redis check fails (/health/ready)', async () => {
    mockRedisClient.ping.mockRejectedValue(new Error('Redis timeout'));

    const resMock: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.getReady(resMock);

    expect(resMock.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(resMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        checks: { database: 'up', redis: 'down' },
      }),
    );
  });
});
