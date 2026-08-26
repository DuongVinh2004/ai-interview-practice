import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from '../billing.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MockBillingProvider } from '../providers/mock-billing.provider';
import { StripeProvider } from '../providers/stripe.provider';
import { PayosProvider } from '../providers/payos.provider';
import { UsageMeterService } from '../usage-meter.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SubscriptionStatus } from '@ai-interview/contracts';

describe('PayOS Webhook Processing (Module B4)', () => {
  let billingService: BillingService;
  let eventEmitter: EventEmitter2;

  const mockOpenInvoice = {
    id: 'inv-payos-1',
    userId: 'user-123',
    amountTotal: 499000,
    currency: 'VND',
    status: 'OPEN',
    stripeInvoiceId: 'PAYOS_987654',
    pdfUrl: JSON.stringify({ planSlug: 'pro', billingCycle: 'monthly' }),
  };

  const mockPrisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        profile: { fullName: 'Nguyen Van A' },
      }),
    },
    subscriptionPlan: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'plan-pro',
        slug: 'pro',
        name: 'Pro Tier',
        priceMonthly: 19.99,
        priceYearly: 199.99,
      }),
    },
    subscription: {
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'sub-new-1' }),
      update: jest.fn().mockResolvedValue({ id: 'sub-updated-1' }),
    },
    invoice: {
      findFirst: jest.fn().mockResolvedValue(mockOpenInvoice),
      create: jest.fn().mockResolvedValue({ id: 'inv-payos-1' }),
      update: jest.fn().mockResolvedValue({ id: 'inv-payos-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn().mockImplementation(async (callback: any) => {
      return callback(mockPrisma);
    }),
  };

  const mockPayosProvider = {
    verifyWebhookData: jest.fn().mockResolvedValue({
      orderCode: 987654,
      amount: 499000,
      code: '00',
    }),
    createPaymentLink: jest.fn(),
    isConfiguredProvider: jest.fn().mockReturnValue(true),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MockBillingProvider, useValue: {} },
        { provide: StripeProvider, useValue: {} },
        { provide: PayosProvider, useValue: mockPayosProvider },
        { provide: UsageMeterService, useValue: {} },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    billingService = module.get<BillingService>(BillingService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    jest.clearAllMocks();
  });

  it('processes valid PayOS webhook, upgrades subscription, marks invoice PAID, and emits billing.payment_succeeded', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(mockOpenInvoice);
    mockPayosProvider.verifyWebhookData.mockResolvedValue({
      orderCode: 987654,
      amount: 499000,
      code: '00',
    });

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

    const result = await billingService.handlePayosWebhook(webhookPayload);
    expect(result.success).toBe(true);

    expect(mockPrisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-123',
          planId: 'plan-pro',
          provider: 'PAYOS',
          status: SubscriptionStatus.ACTIVE,
        }),
      }),
    );

    expect(mockPrisma.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'inv-payos-1',
          status: 'OPEN',
        },
        data: expect.objectContaining({
          status: 'PAID',
        }),
      }),
    );

    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'billing.payment_succeeded',
      expect.objectContaining({
        userId: 'user-123',
        email: 'test@example.com',
        amount: 499000,
        currency: 'VND',
        paymentMethod: 'VietQR (PayOS)',
      }),
    );
  });

  it('rejects unverified / invalid signature webhook and performs zero mutations (fails closed)', async () => {
    mockPayosProvider.verifyWebhookData.mockResolvedValue(null);

    const forgedPayload = {
      code: '00',
      desc: 'success',
      data: {
        orderCode: 987654,
        amount: 499000,
        code: '00',
      },
      signature: 'forged_signature',
    };

    await expect(billingService.handlePayosWebhook(forgedPayload)).rejects.toMatchObject({
      status: 400,
      message: 'Invalid PayOS webhook signature or payload',
    });

    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rejects webhook when no matching pending invoice exists (fails closed)', async () => {
    mockPayosProvider.verifyWebhookData.mockResolvedValue({
      orderCode: 999999,
      amount: 499000,
      code: '00',
    });
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    const payload = {
      code: '00',
      desc: 'success',
      data: {
        orderCode: 999999,
        amount: 499000,
        code: '00',
      },
      signature: 'valid_sig',
    };

    await expect(billingService.handlePayosWebhook(payload)).rejects.toMatchObject({
      status: 404,
      message: 'No pending invoice found for PayOS order 999999',
    });

    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rejects webhook when amount does not match invoice amountTotal (fails closed)', async () => {
    mockPayosProvider.verifyWebhookData.mockResolvedValue({
      orderCode: 987654,
      amount: 1000, // Forged lower amount
      code: '00',
    });
    mockPrisma.invoice.findFirst.mockResolvedValue(mockOpenInvoice); // amountTotal: 499000

    const payload = {
      code: '00',
      desc: 'success',
      data: {
        orderCode: 987654,
        amount: 1000,
        code: '00',
      },
      signature: 'valid_sig',
    };

    await expect(billingService.handlePayosWebhook(payload)).rejects.toMatchObject({
      status: 400,
      message: 'Payment amount mismatch',
    });

    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rejects webhook when currency does not match invoice currency (fails closed)', async () => {
    mockPayosProvider.verifyWebhookData.mockResolvedValue({
      orderCode: 987654,
      amount: 499000,
      code: '00',
      currency: 'USD', // Mismatched currency
    });
    mockPrisma.invoice.findFirst.mockResolvedValue(mockOpenInvoice); // currency: 'VND'

    const payload = {
      code: '00',
      desc: 'success',
      data: {
        orderCode: 987654,
        amount: 499000,
        code: '00',
        currency: 'USD',
      },
      signature: 'valid_sig',
    };

    await expect(billingService.handlePayosWebhook(payload)).rejects.toMatchObject({
      status: 400,
      message: 'Payment currency mismatch',
    });

    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('idempotently handles already-processed (PAID) webhook on replay without side effects', async () => {
    mockPayosProvider.verifyWebhookData.mockResolvedValue({
      orderCode: 987654,
      amount: 499000,
      code: '00',
      currency: 'VND',
    });
    mockPrisma.invoice.findFirst.mockResolvedValue({
      ...mockOpenInvoice,
      status: 'PAID',
    });

    const payload = {
      code: '00',
      desc: 'success',
      data: {
        orderCode: 987654,
        amount: 499000,
        code: '00',
        currency: 'VND',
      },
      signature: 'valid_sig',
    };

    const result = await billingService.handlePayosWebhook(payload);
    expect(result.success).toBe(true);
    expect(result.message).toBe('PayOS webhook already processed');

    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rejects replayed webhook with matching orderCode but mismatched amount even if invoice is already PAID (fails closed)', async () => {
    mockPayosProvider.verifyWebhookData.mockResolvedValue({
      orderCode: 987654,
      amount: 1000, // Tampered lower amount on replay
      code: '00',
      currency: 'VND',
    });
    mockPrisma.invoice.findFirst.mockResolvedValue({
      ...mockOpenInvoice,
      status: 'PAID',
    });

    const payload = {
      code: '00',
      desc: 'success',
      data: {
        orderCode: 987654,
        amount: 1000,
        code: '00',
        currency: 'VND',
      },
      signature: 'valid_sig',
    };

    await expect(billingService.handlePayosWebhook(payload)).rejects.toMatchObject({
      status: 400,
      message: 'Payment amount mismatch',
    });

    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rejects replayed webhook with matching orderCode but mismatched currency even if invoice is already PAID (fails closed)', async () => {
    mockPayosProvider.verifyWebhookData.mockResolvedValue({
      orderCode: 987654,
      amount: 499000,
      code: '00',
      currency: 'USD', // Tampered currency on replay
    });
    mockPrisma.invoice.findFirst.mockResolvedValue({
      ...mockOpenInvoice,
      status: 'PAID',
    });

    const payload = {
      code: '00',
      desc: 'success',
      data: {
        orderCode: 987654,
        amount: 499000,
        code: '00',
        currency: 'USD',
      },
      signature: 'valid_sig',
    };

    await expect(billingService.handlePayosWebhook(payload)).rejects.toMatchObject({
      status: 400,
      message: 'Payment currency mismatch',
    });

    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('handles non-success transaction code without updating invoice to PAID or upgrading subscription', async () => {
    mockPayosProvider.verifyWebhookData.mockResolvedValue({
      orderCode: 987654,
      amount: 499000,
      code: '01', // Failed transaction code
      currency: 'VND',
    });

    const payload = {
      code: '01',
      desc: 'failed',
      data: {
        orderCode: 987654,
        amount: 499000,
        code: '01',
        currency: 'VND',
      },
      signature: 'valid_sig',
    };

    const result = await billingService.handlePayosWebhook(payload);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Transaction failed with code 01');

    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });
});
