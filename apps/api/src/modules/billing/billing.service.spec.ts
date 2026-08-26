import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { UsageMeterService } from './usage-meter.service';
import { MockBillingProvider } from './providers/mock-billing.provider';
import { StripeProvider } from './providers/stripe.provider';
import { PayosProvider } from './providers/payos.provider';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../platform/prisma/prisma.service';
import { SubscriptionStatus } from '@ai-interview/contracts';

describe('BillingService (F014)', () => {
  let service: BillingService;
  let prismaMock: any;
  let configGet: jest.Mock;
  let mockBillingProvider: MockBillingProvider;
  let stripeProvider: StripeProvider;

  const mockPlan = {
    id: '00000000-0000-0000-0000-000000000001',
    slug: 'pro',
    name: 'Pro Tier',
    nameVi: 'Gói Pro',
    description: 'Pro description',
    priceMonthly: 19.0,
    priceYearly: 190.0,
    currency: 'USD',
    features: ['Unlimited AI evaluation'],
    limits: {
      sessionsPerMonth: 20,
      voiceMinutesPerMonth: 60,
      allowLiveCoding: true,
      allowSystemDesign: true,
      mentorFeedbackLimit: 5,
    },
    isActive: true,
  };

  beforeEach(async () => {
    configGet = jest.fn((_key, defaultValue) => defaultValue);
    prismaMock = {
      subscriptionPlan: {
        findMany: jest.fn().mockResolvedValue([mockPlan]),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.slug === 'pro' || where.id === mockPlan.id) return Promise.resolve(mockPlan);
          return Promise.resolve(null);
        }),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: '00000000-0000-0000-0000-000000000002', email: 'dev@test.com' }),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: '00000000-0000-0000-0000-000000000003',
          userId: '00000000-0000-0000-0000-000000000002',
          planId: mockPlan.id,
          plan: mockPlan,
          status: SubscriptionStatus.ACTIVE,
          provider: 'MOCK',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        }),
        create: jest.fn().mockResolvedValue({ id: 'sub-1', planId: mockPlan.id }),
        update: jest.fn().mockResolvedValue({
          id: '00000000-0000-0000-0000-000000000003',
          userId: '00000000-0000-0000-0000-000000000002',
          planId: mockPlan.id,
          plan: mockPlan,
          status: SubscriptionStatus.ACTIVE,
          provider: 'MOCK',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: true,
          canceledAt: new Date(),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      invoice: {
        create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: '00000000-0000-0000-0000-000000000004',
            userId: '00000000-0000-0000-0000-000000000002',
            amountTotal: 19.0,
            currency: 'USD',
            status: 'PAID',
            issuedAt: new Date(),
          },
        ]),
      },
      promoCode: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.code === 'PROMO20') {
            return Promise.resolve({
              code: 'PROMO20',
              discountType: 'PERCENTAGE',
              discountValue: 20.0,
              isActive: true,
              maxUses: 100,
              usedCount: 5,
            });
          }
          return Promise.resolve(null);
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
      $transaction: jest.fn(cb => (typeof cb === 'function' ? cb(prismaMock) : Promise.all(cb))),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        MockBillingProvider,
        StripeProvider,
        PayosProvider,
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: UsageMeterService,
          useValue: { checkQuota: jest.fn(), recordUsage: jest.fn(), getUsageSummary: jest.fn() },
        },
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: { get: configGet },
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    mockBillingProvider = module.get<MockBillingProvider>(MockBillingProvider);
    stripeProvider = module.get<StripeProvider>(StripeProvider);
  });

  it('should list all active subscription plans', async () => {
    const plans = await service.listPlans();
    expect(plans.length).toBe(1);
    expect(plans[0].slug).toBe('pro');
    expect(plans[0].priceMonthly).toBe(19);
  });

  it('should create mock checkout session and activate subscription', async () => {
    const checkout = await service.createCheckout('00000000-0000-0000-0000-000000000002', {
      planSlug: 'pro',
      billingCycle: 'monthly',
      successUrl: 'https://ai-interview.dev/billing/success',
      cancelUrl: 'https://ai-interview.dev/billing',
    });

    expect(checkout.sessionId).toBeDefined();
    expect(checkout.checkoutUrl).toContain('https://ai-interview.dev/billing/success');
    expect(prismaMock.subscription.update).toHaveBeenCalled();
    expect(prismaMock.invoice.create).toHaveBeenCalled();
  });

  it('fails closed when Stripe is not configured in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const mockCheckout = jest.spyOn(mockBillingProvider, 'createCheckoutSession');

    try {
      process.env.NODE_ENV = 'production';

      await expect(
        service.createCheckout('00000000-0000-0000-0000-000000000002', {
          planSlug: 'pro',
          billingCycle: 'monthly',
          successUrl: 'https://ai-interview.dev/billing/success',
          cancelUrl: 'https://ai-interview.dev/billing',
        }),
      ).rejects.toMatchObject({
        message: 'Payment processing is currently unavailable',
        status: 503,
      });

      expect(mockCheckout).not.toHaveBeenCalled();
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
      expect(prismaMock.invoice.create).not.toHaveBeenCalled();
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('uses Stripe instead of mock checkout when configured in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const stripeCheckout = jest.spyOn(stripeProvider, 'createCheckoutSession').mockResolvedValue({
      sessionId: 'cs_test_123',
      checkoutUrl: 'https://stripe.test/checkout',
    });
    const mockCheckout = jest.spyOn(mockBillingProvider, 'createCheckoutSession');
    configGet.mockImplementation((key, defaultValue) =>
      key === 'STRIPE_SECRET_KEY' ? 'configured-test-value' : defaultValue,
    );

    try {
      process.env.NODE_ENV = 'production';

      const checkout = await service.createCheckout('00000000-0000-0000-0000-000000000002', {
        planSlug: 'pro',
        billingCycle: 'monthly',
        successUrl: 'https://ai-interview.dev/billing/success',
        cancelUrl: 'https://ai-interview.dev/billing',
      });

      expect(checkout.sessionId).toBe('cs_test_123');
      expect(stripeCheckout).toHaveBeenCalledTimes(1);
      expect(mockCheckout).not.toHaveBeenCalled();
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('should cancel subscription at period end', async () => {
    const result = await service.cancelSubscription('00000000-0000-0000-0000-000000000002');
    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(prismaMock.subscription.update).toHaveBeenCalled();
  });

  it('cancels Stripe recurring billing before account deletion', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        id: 'subscription-1',
        provider: 'STRIPE',
        providerSubId: 'sub_remote_1',
      },
    ]);
    const cancelStripe = jest
      .spyOn(stripeProvider, 'cancelSubscriptionImmediately')
      .mockResolvedValue(undefined);

    await service.cancelSubscriptionsForAccountDeletion('user-1');

    expect(cancelStripe).toHaveBeenCalledWith('sub_remote_1');
    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['subscription-1'] } },
      data: {
        status: SubscriptionStatus.CANCELED,
        cancelAtPeriodEnd: false,
        canceledAt: expect.any(Date),
      },
    });
  });

  it('should validate valid promo code and reject invalid code', async () => {
    const validPromo = await service.validatePromoCode('PROMO20');
    expect(validPromo.valid).toBe(true);
    expect(validPromo.discountPercent).toBe(20);

    const invalidPromo = await service.validatePromoCode('NONEXISTENT');
    expect(invalidPromo.valid).toBe(false);
  });

  it('should verify Stripe webhook signature and reject forged signatures', async () => {
    const webhookSecret = (await import('crypto')).randomBytes(32);
    const stripeProvider = new StripeProvider({
      get: jest.fn((k: string) => (k === 'STRIPE_WEBHOOK_SECRET' ? webhookSecret : '')),
    } as any);

    const crypto = await import('crypto');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({ id: 'evt_123', type: 'invoice.payment_succeeded' });
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${payload}`, 'utf8')
      .digest('hex');

    const header = `t=${timestamp},v1=${signature}`;
    const result = await stripeProvider.handleWebhook(JSON.parse(payload), header, payload);
    expect(result.handled).toBe(true);
    expect(result.eventType).toBe('invoice.payment_succeeded');

    // Forged signature rejection
    const forgedHeader = `t=${timestamp},v1=forged_signature_hex`;
    await expect(
      stripeProvider.handleWebhook(JSON.parse(payload), forgedHeader, payload),
    ).rejects.toThrow('Invalid Stripe webhook signature');
  });

  it('should reject PayOS payment creation when returnUrl or cancelUrl has an untrusted host (SEC-010)', async () => {
    await expect(
      service.createPayosPayment('00000000-0000-0000-0000-000000000002', {
        planSlug: 'pro',
        billingCycle: 'monthly',
        returnUrl: 'https://attacker-phishing-site.com/steal-creds',
      }),
    ).rejects.toThrow('Invalid redirect URL host');

    await expect(
      service.createPayosPayment('00000000-0000-0000-0000-000000000002', {
        planSlug: 'pro',
        billingCycle: 'monthly',
        cancelUrl: 'javascript:alert(1)',
      }),
    ).rejects.toThrow('Malformed redirect URL');
  });
});
