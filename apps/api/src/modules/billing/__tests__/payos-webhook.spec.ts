import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from '../billing.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MockBillingProvider } from '../providers/mock-billing.provider';
import { StripeProvider } from '../providers/stripe.provider';
import { PayosProvider } from '../providers/payos.provider';
import { UsageMeterService } from '../usage-meter.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction, SubscriptionStatus } from '@ai-interview/contracts';

describe('PayOS Webhook Processing (Module B4)', () => {
  let billingService: BillingService;
  let eventEmitter: EventEmitter2;

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
      create: jest.fn().mockResolvedValue({ id: 'inv-payos-1' }),
    },
    auditLog: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'audit-1',
        userId: 'user-123',
        action: AuditAction.SUBSCRIPTION_CREATED,
        resource: 'subscription_payos',
        details: { orderCode: 987654, planSlug: 'pro', billingCycle: 'monthly' },
      }),
      create: jest.fn().mockResolvedValue({ id: 'audit-2' }),
    },
    $transaction: jest.fn().mockImplementation(async (callback: any) => {
      return callback(mockPrisma);
    }),
  };

  const mockPayosProvider = {
    verifyWebhookData: jest.fn().mockReturnValue({
      orderCode: 987654,
      amount: 499000,
      code: '00',
    }),
    createPaymentLink: jest.fn(),
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

  it('processes valid PayOS webhook, upgrades subscription, and emits billing.payment_succeeded', async () => {
    const webhookPayload = {
      code: '00',
      desc: 'success',
      data: {
        orderCode: 987654,
        amount: 499000,
        code: '00',
      },
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

    expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-123',
          amountTotal: 499000,
          currency: 'VND',
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
});
