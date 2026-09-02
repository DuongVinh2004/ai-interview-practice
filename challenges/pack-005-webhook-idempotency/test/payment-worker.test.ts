import { PaymentWebhookWorker } from '../src/payment-worker';

describe('PaymentWebhookWorker', () => {
  it('should instantiate and be defined', () => {
    const worker = new PaymentWebhookWorker();
    expect(worker).toBeDefined();
  });
});
