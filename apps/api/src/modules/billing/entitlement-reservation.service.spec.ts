import { BillingMetric } from '@ai-interview/contracts';
import {
  EntitlementMetric,
  EntitlementReservationService,
} from './entitlement-reservation.service';

describe('EntitlementReservationService', () => {
  it('keeps an active free-tier subscription in the monthly free bucket', async () => {
    const prisma: any = {};
    const service = new EntitlementReservationService(prisma);
    const tx = {
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'free-subscription',
          status: 'ACTIVE',
          currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
          currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
          plan: { slug: 'free', limits: { voiceMinutesPerMonth: 0 } },
        }),
      },
    };

    const policy = await service.getPolicyInTransaction(
      tx,
      'user-1',
      EntitlementMetric.AUDIO_MINUTES,
    );

    expect(policy.limit).toBe(15);
    expect(policy.accessPeriodKey).toMatch(/^month_\d{4}-\d{2}$/);
  });

  it('records operator-confirmed provider usage atomically from reconciliation', async () => {
    const tx: any = {
      entitlementReservation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'reservation-1',
          state: 'RECONCILIATION_REQUIRED',
          bucketId: 'bucket-1',
          userId: 'user-1',
          metric: EntitlementMetric.AUDIO_MINUTES,
          estimatedQuantity: 15,
          provider: 'openai',
          providerOperationId: null,
        }),
        update: jest.fn().mockResolvedValue({ id: 'reservation-1', state: 'COMMITTED' }),
      },
      entitlementBucket: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'bucket-1',
          limit: 100,
          consumed: 10,
          reserved: 15,
          version: 3,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      usageRecord: { create: jest.fn().mockResolvedValue({ id: 'usage-1' }) },
    };
    const prisma: any = {
      $transaction: jest.fn((callback: (transaction: any) => unknown) => callback(tx)),
    };
    const service = new EntitlementReservationService(prisma);

    await service.resolveReconciliation({
      reservationId: 'reservation-1',
      outcome: 'CONFIRMED_PROVIDER_USAGE',
      actualQuantity: 20,
      evidence: { providerRequestId: 'req-1' },
    });

    expect(tx.entitlementBucket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reserved: { decrement: 15 },
          consumed: { increment: 20 },
        }),
      }),
    );
    expect(tx.usageRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metric: BillingMetric.AUDIO_MINUTE,
          quantity: 20,
          reservationId: 'reservation-1',
        }),
      }),
    );
  });
});
