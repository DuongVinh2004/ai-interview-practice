import { Test, TestingModule } from '@nestjs/testing';
import { UsageMeterService } from './usage-meter.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { BillingMetric } from '@ai-interview/contracts';

describe('UsageMeterService (F014)', () => {
  let service: UsageMeterService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(prismaMock)),
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sub-1',
          userId: 'user-1',
          status: 'ACTIVE',
          plan: {
            limits: {
              sessionsPerMonth: 20,
              voiceMinutesPerMonth: 60,
            },
          },
        }),
      },
      usageRecord: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { quantity: 5 },
        }),
        create: jest.fn().mockResolvedValue({ id: 'rec-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsageMeterService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<UsageMeterService>(UsageMeterService);
  });

  it('should enforce quota limits and calculate remaining allowances', async () => {
    const quota = await service.checkQuota('user-1', BillingMetric.SESSION_COUNT);

    expect(quota.allowed).toBe(true);
    expect(quota.currentUsage).toBe(5);
    expect(quota.limit).toBe(20);
    expect(quota.remaining).toBe(15);
  });

  it('should deny access when quota is exhausted', async () => {
    prismaMock.usageRecord.aggregate.mockResolvedValueOnce({
      _sum: { quantity: 20 },
    });

    const quota = await service.checkQuota('user-1', BillingMetric.SESSION_COUNT);

    expect(quota.allowed).toBe(false);
    expect(quota.remaining).toBe(0);
  });

  it('should atomically check and consume quota within transaction', async () => {
    const consumed = await service.checkAndConsumeQuota('user-1', BillingMetric.SESSION_COUNT, 1);
    expect(consumed.allowed).toBe(true);
    expect(consumed.currentUsage).toBe(6);
    expect(consumed.remaining).toBe(14);
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.usageRecord.create).toHaveBeenCalled();
  });

  it('should reject quota consumption if requested amount exceeds remaining allowance', async () => {
    prismaMock.usageRecord.aggregate.mockResolvedValueOnce({
      _sum: { quantity: 20 },
    });

    await expect(
      service.checkAndConsumeQuota('user-1', BillingMetric.SESSION_COUNT, 1),
    ).rejects.toThrow('Monthly quota exceeded for SESSION_COUNT');
  });

  it('should record usage metrics in database', async () => {
    await service.recordUsage('user-1', BillingMetric.AI_TOKEN, 450);

    expect(prismaMock.usageRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          metric: BillingMetric.AI_TOKEN,
          quantity: 450,
        }),
      }),
    );
  });
});
