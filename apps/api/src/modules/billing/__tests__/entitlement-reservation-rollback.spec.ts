import { ConflictException } from '@nestjs/common';
import {
  EntitlementMetric,
  EntitlementReservationService,
} from '../entitlement-reservation.service';

describe('EntitlementReservationService - Commit Rollback Prevention', () => {
  it('persists RECONCILIATION_REQUIRED before throwing ConflictException outside transaction', async () => {
    let transactionCommitted = false;

    const tx: any = {
      entitlementReservation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'res-overflow-1',
          state: 'RESERVED',
          bucketId: 'bucket-1',
          userId: 'user-1',
          metric: EntitlementMetric.AUDIO_MINUTES,
          estimatedQuantity: 10,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'res-overflow-1',
          state: 'RECONCILIATION_REQUIRED',
          actualQuantity: 25,
        }),
      },
      entitlementBucket: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const prisma: any = {
      $transaction: jest.fn(async (callback: (t: any) => Promise<any>) => {
        const res = await callback(tx);
        transactionCommitted = true;
        return res;
      }),
    };

    const service = new EntitlementReservationService(prisma);

    await expect(
      service.commit({
        reservationId: 'res-overflow-1',
        actualQuantity: 25,
      }),
    ).rejects.toThrow(ConflictException);

    // Assert that the transaction committed the DB update
    expect(transactionCommitted).toBe(true);
    expect(tx.entitlementReservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res-overflow-1' },
        data: expect.objectContaining({
          state: 'RECONCILIATION_REQUIRED',
          actualQuantity: 25,
        }),
      }),
    );
  });
});
