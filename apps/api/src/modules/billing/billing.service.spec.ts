import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { UsageMeterService } from './usage-meter.service';
import { MockBillingProvider } from './providers/mock-billing.provider';
import { StripeProvider } from './providers/stripe.provider';
import { PrismaService } from '../platform/prisma/prisma.service';
import { SubscriptionStatus } from '@ai-interview/contracts';

describe('BillingService (F014)', () => {
  let service: BillingService;
  let prismaMock: any;

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
    prismaMock = {
      subscriptionPlan: {
        findMany: jest.fn().mockResolvedValue([mockPlan]),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.slug === 'pro' || where.id === mockPlan.id) return Promise.resolve(mockPlan);
          return Promise.resolve(null);
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000002', email: 'dev@test.com' }),
      },
      subscription: {
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
              discountValue: 20,
              isActive: true,
              usedCount: 0,
              maxUses: 100,
            });
          }
          return Promise.resolve(null);
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        MockBillingProvider,
        StripeProvider,
        {
          provide: UsageMeterService,
          useValue: { checkQuota: jest.fn(), recordUsage: jest.fn(), getUsageSummary: jest.fn() },
        },
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((k, def) => def) },
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
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

  it('should cancel subscription at period end', async () => {
    const result = await service.cancelSubscription('00000000-0000-0000-0000-000000000002');
    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(prismaMock.subscription.update).toHaveBeenCalled();
  });

  it('should validate valid promo code and reject invalid code', async () => {
    const validPromo = await service.validatePromoCode('PROMO20');
    expect(validPromo.valid).toBe(true);
    expect(validPromo.discountPercent).toBe(20);

    const invalidPromo = await service.validatePromoCode('NONEXISTENT');
    expect(invalidPromo.valid).toBe(false);
  });
});
