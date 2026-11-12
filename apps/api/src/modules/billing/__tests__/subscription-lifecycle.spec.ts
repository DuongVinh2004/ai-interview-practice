import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from '../billing.service';
import { UsageMeterService } from '../usage-meter.service';
import { StripeProvider } from '../providers/stripe.provider';
import { PayosProvider } from '../providers/payos.provider';
import { MockBillingProvider } from '../providers/mock-billing.provider';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SubscriptionStatus, BillingMetric } from '@ai-interview/contracts';

describe('Subscription Lifecycle End-to-End Suite (Sprint 5 - Task 5.4)', () => {
  let billingService: BillingService;
  let usageMeterService: UsageMeterService;
  let stripeProvider: StripeProvider;
  let payosProvider: PayosProvider;
  let eventEmitter: EventEmitter2;

  const testUserId = '00000000-0000-0000-0000-0000000000aa';
  const testUserEmail = 'engineer@example.com';

  const freePlan = {
    id: '00000000-0000-0000-0000-000000000001',
    slug: 'free',
    name: 'Free Tier',
    nameVi: 'Gói Miễn Phí',
    description: 'Free tier description',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    features: ['5 interview sessions / month'],
    limits: {
      sessionsPerMonth: 5,
      voiceMinutesPerMonth: 0,
      allowLiveCoding: true,
      allowSystemDesign: false,
      mentorFeedbackLimit: 1,
    },
    isActive: true,
  };

  const proPlan = {
    id: '00000000-0000-0000-0000-000000000002',
    slug: 'pro',
    name: 'Pro Tier',
    nameVi: 'Gói Chuyên Nghiệp',
    description: 'Pro tier description',
    priceMonthly: 9.99,
    priceYearly: 99.99,
    currency: 'USD',
    features: ['50 interview sessions / month', '60 voice streaming minutes'],
    limits: {
      sessionsPerMonth: 50,
      voiceMinutesPerMonth: 60,
      allowLiveCoding: true,
      allowSystemDesign: true,
      mentorFeedbackLimit: 10,
    },
    isActive: true,
  };

  let dbSubscription: any = null;
  let dbInvoices: any[] = [];
  let dbAuditLogs: any[] = [];

  const mockPrisma: any = {
    subscriptionPlan: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve([freePlan, proPlan])),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.slug === 'free' || where.id === freePlan.id) return Promise.resolve(freePlan);
        if (where.slug === 'pro' || where.id === proPlan.id) return Promise.resolve(proPlan);
        return Promise.resolve(null);
      }),
    },
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === testUserId) {
          return Promise.resolve({
            id: testUserId,
            email: testUserEmail,
            profile: { fullName: 'Lead Engineer' },
          });
        }
        return Promise.resolve(null);
      }),
    },
    subscription: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (where.userId === testUserId && dbSubscription) {
          if (where.status && where.status !== dbSubscription.status) {
            return Promise.resolve(null);
          }
          return Promise.resolve(dbSubscription);
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        if (where.userId === testUserId && dbSubscription) {
          return Promise.resolve([dbSubscription]);
        }
        return Promise.resolve([]);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        dbSubscription = {
          id: 'sub-uuid-1',
          ...data,
          plan: data.planId === proPlan.id ? proPlan : freePlan,
        };
        return Promise.resolve(dbSubscription);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        if (dbSubscription && dbSubscription.id === where.id) {
          dbSubscription = {
            ...dbSubscription,
            ...data,
            plan: data.planId
              ? data.planId === proPlan.id
                ? proPlan
                : freePlan
              : dbSubscription.plan,
          };
          return Promise.resolve(dbSubscription);
        }
        return Promise.resolve(null);
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }) => {
        if (
          dbSubscription &&
          (where.providerSubId === dbSubscription.providerSubId ||
            where.id?.in?.includes(dbSubscription.id))
        ) {
          dbSubscription = { ...dbSubscription, ...data };
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      }),
    },
    invoice: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          dbInvoices.find(inv => inv.stripeInvoiceId === where.stripeInvoiceId) || null,
        );
      }),
      findMany: jest.fn().mockImplementation(() => Promise.resolve(dbInvoices)),
      create: jest.fn().mockImplementation(({ data }) => {
        const inv = { id: `inv-${Date.now()}`, ...data };
        dbInvoices.push(inv);
        return Promise.resolve(inv);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const target = dbInvoices.find(inv => inv.id === where.id);
        if (target) {
          Object.assign(target, data);
          return Promise.resolve(target);
        }
        return Promise.resolve(null);
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }) => {
        const target = dbInvoices.find(inv => inv.id === where.id && inv.status === where.status);
        if (target) {
          Object.assign(target, data);
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      }),
      upsert: jest.fn().mockImplementation(({ where, update, create }) => {
        const existing = dbInvoices.find(inv => inv.stripeInvoiceId === where.stripeInvoiceId);
        if (existing) {
          Object.assign(existing, update);
          return Promise.resolve(existing);
        }
        const created = { id: `inv-${Date.now()}`, ...create };
        dbInvoices.push(created);
        return Promise.resolve(created);
      }),
    },
    auditLog: {
      create: jest.fn().mockImplementation(({ data }) => {
        dbAuditLogs.push(data);
        return Promise.resolve({ id: `audit-${Date.now()}`, ...data });
      }),
    },
    stripeEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'evt-1', processed: false }),
      update: jest.fn().mockResolvedValue({ id: 'evt-1', processed: true }),
    },
    usageRecord: {
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
    },
    $transaction: jest.fn().mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') return cb(mockPrisma);
      return Promise.all(cb);
    }),
  };

  beforeEach(async () => {
    dbSubscription = null;
    dbInvoices = [];
    dbAuditLogs = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        UsageMeterService,
        MockBillingProvider,
        StripeProvider,
        PayosProvider,
        EventEmitter2,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'billing.provider') return 'mock';
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock_stripe';
              if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test_secret';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    billingService = module.get<BillingService>(BillingService);
    usageMeterService = module.get<UsageMeterService>(UsageMeterService);
    stripeProvider = module.get<StripeProvider>(StripeProvider);
    payosProvider = module.get<PayosProvider>(PayosProvider);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('Stage 1: Returns default Free tier subscription and zero usage when no subscription exists', async () => {
    const sub = await billingService.getSubscription(testUserId);
    expect(sub).not.toBeNull();
    expect(sub!.plan.slug).toBe('free');
    expect(sub!.status).toBe(SubscriptionStatus.ACTIVE);
    expect(sub!.cancelAtPeriodEnd).toBe(false);

    const sessionQuota = await usageMeterService.checkQuota(
      testUserId,
      BillingMetric.SESSION_COUNT,
    );
    expect(sessionQuota.limit).toBe(3);

    const voiceQuota = await usageMeterService.checkQuota(testUserId, BillingMetric.AUDIO_MINUTE);
    expect(voiceQuota.limit).toBe(15);
  });

  it('Stage 2: Upgrades to Pro via checkout session and activates on Stripe webhook completion', async () => {
    const eventSpy = jest.spyOn(eventEmitter, 'emit');

    // 1. User checks out for Pro
    const checkout = await billingService.createCheckout(testUserId, {
      planSlug: 'pro',
      billingCycle: 'monthly',
      successUrl: 'https://ai-interview.dev/billing?success=true',
      cancelUrl: 'https://ai-interview.dev/billing?canceled=true',
    });
    expect(checkout.checkoutUrl).toBeDefined();

    // 2. Stripe delivers checkout.session.completed webhook
    const eventPayload = {
      id: 'evt_checkout_stage2',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_stage2',
          subscription: 'sub_stripe_prod_1',
          client_reference_id: testUserId,
          metadata: {
            userId: testUserId,
            planSlug: 'pro',
            billingCycle: 'monthly',
          },
          amount_total: 999,
          currency: 'usd',
        },
      },
    };

    jest.spyOn(stripeProvider, 'verifyWebhookSignature').mockReturnValue(true);
    await stripeProvider.handleWebhook(
      eventPayload,
      't=123,v1=valid_sig',
      JSON.stringify(eventPayload),
    );

    // Verify DB state elevated to Pro
    expect(dbSubscription).toBeDefined();
    expect(dbSubscription.planId).toBe(proPlan.id);
    expect(dbSubscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(dbSubscription.provider).toBe('STRIPE');
    expect(dbSubscription.providerSubId).toBe('sub_stripe_prod_1');

    // Verify invoice created & marked PAID
    expect(dbInvoices.length).toBeGreaterThan(0);
    expect(dbInvoices[0].status).toBe('PAID');

    // Verify payment receipt email event dispatched
    expect(eventSpy).toHaveBeenCalledWith(
      'billing.payment_succeeded',
      expect.objectContaining({
        userId: testUserId,
        email: testUserEmail,
        planName: proPlan.name,
        amount: 9.99,
        currency: 'USD',
      }),
    );

    // Verify elevated limits now active
    const sessionQuota = await usageMeterService.checkQuota(
      testUserId,
      BillingMetric.SESSION_COUNT,
    );
    expect(sessionQuota.limit).toBe(50);

    const voiceQuota = await usageMeterService.checkQuota(testUserId, BillingMetric.AUDIO_MINUTE);
    expect(voiceQuota.limit).toBe(60);
  });

  it('Stage 3: Upgrades to Pro via PayOS VietQR and emits billing.payment_succeeded', async () => {
    const eventSpy = jest.spyOn(eventEmitter, 'emit');

    jest.spyOn(payosProvider, 'createPaymentLink').mockImplementation(async params => ({
      orderCode: params.orderCode,
      checkoutUrl: `https://pay.payos.vn/web/mock-${params.orderCode}`,
      qrCode: 'mock-qr-code-string',
      amount: params.amount,
      status: 'PENDING',
      currency: 'VND',
    }));

    // 1. Create PayOS payment link
    const payosResponse = await billingService.createPayosPayment(testUserId, {
      planSlug: 'pro',
      billingCycle: 'monthly',
    });
    expect(payosResponse.orderCode).toBeDefined();
    expect(payosResponse.qrCode).toBeDefined();

    // 2. PayOS delivers successful payment webhook
    const payosWebhookPayload = {
      code: '00',
      desc: 'Success',
      data: {
        orderCode: payosResponse.orderCode,
        amount: payosResponse.amount,
        description: 'AI INT PRO',
        accountNumber: '1234567890',
        reference: 'FT123456',
        transactionDateTime: new Date().toISOString(),
        currency: 'VND',
        paymentLinkId: 'plink_123',
        code: '00',
      },
      signature: 'valid_payos_sig',
    };

    jest
      .spyOn(payosProvider, 'verifyWebhookData')
      .mockResolvedValue(payosWebhookPayload.data as any);
    const result = await billingService.handlePayosWebhook(payosWebhookPayload);

    expect(result.success).toBe(true);
    expect(dbSubscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(dbSubscription.provider).toBe('PAYOS');

    expect(eventSpy).toHaveBeenCalledWith(
      'billing.payment_succeeded',
      expect.objectContaining({
        userId: testUserId,
        paymentMethod: 'VietQR (PayOS)',
        currency: 'VND',
      }),
    );
  });

  it('Stage 4: Candidate self-service cancellation sets cancelAtPeriodEnd without immediate access loss', async () => {
    // Seed an active Pro subscription
    dbSubscription = {
      id: 'sub-active-pro',
      userId: testUserId,
      planId: proPlan.id,
      plan: proPlan,
      status: SubscriptionStatus.ACTIVE,
      provider: 'STRIPE',
      providerSubId: 'sub_stripe_cancel_test',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days left
      cancelAtPeriodEnd: false,
    };

    const canceledSub = await billingService.cancelSubscription(testUserId);
    expect(canceledSub.cancelAtPeriodEnd).toBe(true);
    expect(canceledSub.canceledAt).toBeDefined();
    expect(canceledSub.status).toBe(SubscriptionStatus.ACTIVE); // Still active until period end

    // User continues to enjoy Pro limits until period expires
    const sessionQuota = await usageMeterService.checkQuota(
      testUserId,
      BillingMetric.SESSION_COUNT,
    );
    expect(sessionQuota.limit).toBe(50);
  });

  it('Stage 5: Stripe customer.subscription.deleted finalizes cancellation and revokes Pro limits', async () => {
    // Pre-existing subscription marked to cancel
    dbSubscription = {
      id: 'sub-expiring-pro',
      userId: testUserId,
      planId: proPlan.id,
      plan: proPlan,
      status: SubscriptionStatus.ACTIVE,
      provider: 'STRIPE',
      providerSubId: 'sub_stripe_delete_evt',
      currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(),
      cancelAtPeriodEnd: true,
    };

    const deleteEvent = {
      id: 'evt_sub_deleted_99',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_stripe_delete_evt',
          status: 'canceled',
        },
      },
    };

    jest.spyOn(stripeProvider, 'verifyWebhookSignature').mockReturnValue(true);
    await stripeProvider.handleWebhook(
      deleteEvent,
      't=123,v1=valid_sig',
      JSON.stringify(deleteEvent),
    );

    expect(dbSubscription.status).toBe(SubscriptionStatus.CANCELED);
    expect(dbSubscription.canceledAt).toBeDefined();

    // After final cancellation, usage meter gracefully reverts to Free limits
    const sessionQuota = await usageMeterService.checkQuota(
      testUserId,
      BillingMetric.SESSION_COUNT,
    );
    expect(sessionQuota.limit).toBe(3);
  });

  it('Stage 6: Account deletion immediately terminates external subscription and cancels records', async () => {
    dbSubscription = {
      id: 'sub-gdpr-deletion',
      userId: testUserId,
      planId: proPlan.id,
      plan: proPlan,
      status: SubscriptionStatus.ACTIVE,
      provider: 'STRIPE',
      providerSubId: 'sub_stripe_immediate_del',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    };

    const stripeCancelSpy = jest
      .spyOn(stripeProvider, 'cancelSubscriptionImmediately')
      .mockResolvedValue();

    await billingService.cancelSubscriptionsForAccountDeletion(testUserId);

    expect(stripeCancelSpy).toHaveBeenCalledWith('sub_stripe_immediate_del');
    expect(dbSubscription.status).toBe(SubscriptionStatus.CANCELED);
    expect(dbSubscription.cancelAtPeriodEnd).toBe(false);
  });
});
