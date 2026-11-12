import { Test, TestingModule } from '@nestjs/testing';
import { BillingWebhookController } from './webhook.controller';
import { StripeProvider } from './providers/stripe.provider';
import { BillingService } from './billing.service';

describe('BillingWebhookController (Module B4)', () => {
  let controller: BillingWebhookController;
  let billingService: BillingService;
  let stripeProvider: StripeProvider;

  const mockBillingService = {
    handlePayosWebhook: jest.fn(),
  };

  const mockStripeProvider = {
    handleWebhook: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingWebhookController],
      providers: [
        { provide: BillingService, useValue: mockBillingService },
        { provide: StripeProvider, useValue: mockStripeProvider },
      ],
    }).compile();

    controller = module.get<BillingWebhookController>(BillingWebhookController);
    billingService = module.get<BillingService>(BillingService);
    stripeProvider = module.get<StripeProvider>(StripeProvider);
    jest.clearAllMocks();
  });

  describe('handlePayosWebhook (POST /api/v1/billing/webhook/payos)', () => {
    it('delegates payload to billingService.handlePayosWebhook and returns result', async () => {
      const webhookPayload = {
        code: '00',
        desc: 'success',
        data: {
          orderCode: 987654,
          amount: 499000,
          code: '00',
        },
        signature: 'valid_signature',
      };

      mockBillingService.handlePayosWebhook.mockResolvedValue({
        success: true,
        message: 'PayOS webhook processed successfully',
      });

      const result = await controller.handlePayosWebhook(webhookPayload);

      expect(billingService.handlePayosWebhook).toHaveBeenCalledWith(webhookPayload);
      expect(result).toEqual({
        success: true,
        message: 'PayOS webhook processed successfully',
      });
    });

    it('returns idempotency response when invoice is already PAID', async () => {
      const webhookPayload = {
        code: '00',
        desc: 'success',
        data: {
          orderCode: 987654,
          amount: 499000,
          code: '00',
        },
        signature: 'valid_signature',
      };

      mockBillingService.handlePayosWebhook.mockResolvedValue({
        success: true,
        message: 'PayOS webhook already processed',
      });

      const result = await controller.handlePayosWebhook(webhookPayload);

      expect(billingService.handlePayosWebhook).toHaveBeenCalledWith(webhookPayload);
      expect(result.message).toBe('PayOS webhook already processed');
    });
  });

  describe('handleStripeWebhook (POST /api/v1/billing/webhook/stripe)', () => {
    it('delegates rawBody and signature to stripeProvider.handleWebhook', async () => {
      const mockPayload = { id: 'evt_123', type: 'invoice.payment_succeeded' };
      const rawBuffer = Buffer.from(JSON.stringify(mockPayload));
      const mockReq = {
        rawBody: rawBuffer,
      } as any;
      const signature = 't=123,v1=abc';

      mockStripeProvider.handleWebhook.mockResolvedValue({
        eventType: 'invoice.payment_succeeded',
        handled: true,
      });

      const result = await controller.handleStripeWebhook(mockReq, mockPayload, signature);

      expect(stripeProvider.handleWebhook).toHaveBeenCalledWith(
        mockPayload,
        signature,
        rawBuffer.toString('utf8'),
      );
      expect(result).toEqual({
        eventType: 'invoice.payment_succeeded',
        handled: true,
      });
    });
  });
});
