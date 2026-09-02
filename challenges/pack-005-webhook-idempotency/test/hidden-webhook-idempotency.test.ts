import { PaymentWebhookWorker } from '../src/payment-worker';

describe('Hidden Webhook Idempotency Verification', () => {
  it('skips processing if idempotency key is already registered', async () => {
    const worker = new PaymentWebhookWorker();
    const mockDb = {
      insertIdempotencyKey: jest.fn().mockResolvedValue(false), // Already inserted!
      creditBalance: jest.fn(),
      markOrderPaid: jest.fn(),
    };

    const event = { id: 'evt-dup-1', amount: 100, userId: 'u-1' };
    await worker.processWebhook(event, mockDb);

    expect(mockDb.insertIdempotencyKey).toHaveBeenCalledWith('evt-dup-1');
    expect(mockDb.creditBalance).not.toHaveBeenCalled();
    expect(mockDb.markOrderPaid).not.toHaveBeenCalled();
  });
});
