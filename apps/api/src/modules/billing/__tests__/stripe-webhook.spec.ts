import { Test, TestingModule } from '@nestjs/testing';
import { StripeProvider } from '../providers/stripe.provider';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { IsAllowedRedirectUrlConstraint } from '../dto/billing.dto';
import * as crypto from 'crypto';

describe('Stripe Webhook Handlers & Deduplication (P1-005, P2-001)', () => {
  let stripeProvider: StripeProvider;

  const mockPrisma: any = {
    stripeEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    subscriptionPlan: {
      findUnique: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    invoice: {
      create: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(cb => (typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb))),
  };

  const secret = crypto.randomBytes(32);
  const mockConfigService = {
    get: jest.fn((key: string, defaultVal?: any) => {
      if (key === 'STRIPE_SECRET_KEY') return 'mock_stripe_key_for_tests';
      if (key === 'STRIPE_WEBHOOK_SECRET') return secret;
      return defaultVal;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeProvider,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    stripeProvider = module.get<StripeProvider>(StripeProvider);
    jest.clearAllMocks();
    mockPrisma.stripeEvent.create.mockReset();
    mockPrisma.stripeEvent.update.mockReset();
    mockPrisma.$transaction
      .mockReset()
      .mockImplementation((cb: any) =>
        typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb),
      );
  });

  const signPayload = (payloadStr: string): string => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payloadStr}`)
      .digest('hex');
    return `t=${timestamp},v1=${signature}`;
  };

  it('processes checkout.session.completed and activates subscription for yearly plan', async () => {
    const eventPayload = {
      id: 'evt_checkout_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          subscription: 'sub_stripe_999',
          client_reference_id: 'user-bill-123',
          metadata: {
            userId: 'user-bill-123',
            planSlug: 'pro',
            billingCycle: 'yearly',
          },
          amount_total: 19000,
          currency: 'usd',
        },
      },
    };

    const payloadStr = JSON.stringify(eventPayload);
    const signature = signPayload(payloadStr);

    mockPrisma.stripeEvent.findUnique.mockResolvedValue(null);
    mockPrisma.stripeEvent.create.mockResolvedValue({
      id: 'evt_checkout_123',
      processed: false,
    });
    mockPrisma.stripeEvent.update.mockResolvedValue({
      id: 'evt_checkout_123',
      processed: true,
    });
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      id: 'plan-pro',
      slug: 'pro',
      priceMonthly: 19.99,
      priceYearly: 190.0,
    });
    mockPrisma.subscription.findFirst.mockResolvedValue(null);
    mockPrisma.subscription.create.mockResolvedValue({ id: 'sub-db-1' });
    mockPrisma.invoice.create.mockResolvedValue({});
    mockPrisma.stripeEvent.upsert.mockResolvedValue({});

    const result = await stripeProvider.handleWebhook(eventPayload, signature, payloadStr);
    expect(result.handled).toBe(true);

    // Verifies invoice created with correct amount and PAID status
    expect(mockPrisma.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-bill-123',
        amountTotal: 190,
        status: 'PAID',
      }),
    });

    // Verifies event was recorded in stripe_events for idempotency
    expect(mockPrisma.stripeEvent.create).toHaveBeenCalledWith({
      data: { id: 'evt_checkout_123', eventType: 'checkout.session.completed', processed: false },
    });
    expect(mockPrisma.stripeEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt_checkout_123' },
      data: { processed: true },
    });
  });

  it('skips duplicate webhook events if already processed (Idempotency)', async () => {
    const eventPayload = {
      id: 'evt_duplicate_123',
      type: 'checkout.session.completed',
      data: {
        object: { id: 'cs_duplicate' },
      },
    };

    const payloadStr = JSON.stringify(eventPayload);
    const signature = signPayload(payloadStr);

    mockPrisma.stripeEvent.findUnique.mockResolvedValue({
      id: 'evt_duplicate_123',
      processed: true,
    });

    const result = await stripeProvider.handleWebhook(eventPayload, signature, payloadStr);
    expect(result.handled).toBe(true);

    // Database mutations must not execute on duplicate event
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
  });

  it('claims before effects and treats a concurrent unique conflict as duplicate success', async () => {
    const eventPayload = {
      id: 'evt_concurrent_claim_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_concurrent_claim',
          subscription: 'sub_concurrent_claim',
          client_reference_id: 'user-bill-123',
          metadata: { userId: 'user-bill-123', planSlug: 'pro', billingCycle: 'yearly' },
          amount_total: 19000,
          currency: 'usd',
        },
      },
    };
    const payloadStr = JSON.stringify(eventPayload);
    const signature = signPayload(payloadStr);
    const claimError = Object.assign(new Error('unique conflict'), { code: 'P2002' });
    let claimAttempts = 0;

    mockPrisma.stripeEvent.findUnique.mockResolvedValue(null);
    mockPrisma.stripeEvent.create.mockImplementation(async () => {
      claimAttempts += 1;
      if (claimAttempts === 1) {
        return { id: eventPayload.id, processed: false };
      }
      throw claimError;
    });
    mockPrisma.stripeEvent.update.mockResolvedValue({
      id: eventPayload.id,
      processed: true,
    });
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      id: 'plan-pro',
      slug: 'pro',
      name: 'Pro',
      priceMonthly: 19.99,
      priceYearly: 190.0,
    });
    mockPrisma.subscription.findFirst.mockResolvedValue(null);
    mockPrisma.subscription.create.mockResolvedValue({ id: 'sub-db-concurrent' });
    mockPrisma.invoice.create.mockResolvedValue({});

    const results = await Promise.all([
      stripeProvider.handleWebhook(eventPayload, signature, payloadStr),
      stripeProvider.handleWebhook(eventPayload, signature, payloadStr),
    ]);

    expect(results).toHaveLength(2);
    results.forEach(result =>
      expect(result).toEqual(
        expect.objectContaining({ handled: true, eventType: eventPayload.type }),
      ),
    );
    expect(mockPrisma.subscriptionPlan.findUnique).toHaveBeenCalledWith({
      where: { slug: 'pro' },
    });
    expect(mockPrisma.stripeEvent.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.subscription.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.invoice.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.stripeEvent.create.mock.invocationCallOrder[0]).toBeLessThan(
      mockPrisma.subscription.create.mock.invocationCallOrder[0],
    );
  });

  it('propagates a persistence failure so the webhook delivery can be retried', async () => {
    const eventPayload = {
      id: 'evt_transaction_failure_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_transaction_failure',
          subscription: 'sub_transaction_failure',
          client_reference_id: 'user-bill-123',
          metadata: { userId: 'user-bill-123', planSlug: 'pro', billingCycle: 'monthly' },
          amount_total: 1999,
          currency: 'usd',
        },
      },
    };
    const payloadStr = JSON.stringify(eventPayload);
    const signature = signPayload(payloadStr);
    const persistenceError = new Error('database temporarily unavailable');

    mockPrisma.stripeEvent.findUnique.mockResolvedValue(null);
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      id: 'plan-pro',
      slug: 'pro',
      name: 'Pro',
      priceMonthly: 19.99,
      priceYearly: 190.0,
    });
    mockPrisma.$transaction.mockImplementationOnce(() => Promise.reject(persistenceError));

    await expect(stripeProvider.handleWebhook(eventPayload, signature, payloadStr)).rejects.toBe(
      persistenceError,
    );
  });

  it('propagates the billing cycle to Stripe checkout metadata', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'cs_yearly_123', url: 'https://checkout.stripe.test/yearly' }),
    } as Response);

    try {
      const result = await stripeProvider.createCheckoutSession(
        'user-bill-123',
        'member@example.com',
        {
          planSlug: 'pro',
          billingCycle: 'yearly',
          successUrl: 'https://ai-interview.dev/billing/success',
          cancelUrl: 'https://ai-interview.dev/billing',
        },
        'price_pro_yearly',
      );

      expect(result.sessionId).toBe('cs_yearly_123');
      const request = fetchMock.mock.calls[0][1] as RequestInit;
      expect(new URLSearchParams(String(request.body)).get('metadata[billingCycle]')).toBe(
        'yearly',
      );
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('extends recurring yearly renewals by the provider period instead of one month', async () => {
    const eventPayload = {
      id: 'evt_yearly_renewal_123',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_yearly_renewal_123',
          subscription: 'sub_yearly_renewal',
          amount_paid: 19000,
          currency: 'usd',
          lines: {
            data: [
              {
                price: { recurring: { interval: 'year', interval_count: 1 } },
                period: { end: 1_798_761_600 },
              },
            ],
          },
        },
      },
    };
    const payloadStr = JSON.stringify(eventPayload);
    const signature = signPayload(payloadStr);

    mockPrisma.stripeEvent.findUnique.mockResolvedValue(null);
    mockPrisma.stripeEvent.create.mockResolvedValue({
      id: eventPayload.id,
      processed: false,
    });
    mockPrisma.stripeEvent.update.mockResolvedValue({
      id: eventPayload.id,
      processed: true,
    });
    mockPrisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-db-yearly',
      userId: 'user-bill-123',
      plan: { name: 'Pro', stripePriceIdYearly: 'price_pro_yearly' },
    });
    mockPrisma.invoice.upsert.mockResolvedValue({});

    await stripeProvider.handleWebhook(eventPayload, signature, payloadStr);

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-db-yearly' },
      data: expect.objectContaining({
        status: 'ACTIVE',
        currentPeriodEnd: new Date(1_798_761_600 * 1000),
      }),
    });
    expect(mockPrisma.invoice.upsert).toHaveBeenCalledWith({
      where: { stripeInvoiceId: 'in_yearly_renewal_123' },
      update: expect.objectContaining({
        stripeInvoiceId: 'in_yearly_renewal_123',
        metadata: { billingCycle: 'yearly' },
      }),
      create: expect.objectContaining({
        stripeInvoiceId: 'in_yearly_renewal_123',
        metadata: { billingCycle: 'yearly' },
      }),
    });
  });

  describe('Redirect URL Allowlist Validator (P2-001)', () => {
    const validator = new IsAllowedRedirectUrlConstraint();

    it('rejects open redirect attempts to untrusted external domains', () => {
      expect(validator.validate('https://evil-phishing-site.com/steal-session')).toBe(false);
      expect(validator.validate('javascript:alert(1)')).toBe(false);
      expect(validator.validate('data:text/html,<script>evil()</script>')).toBe(false);
    });

    it('accepts allowed origins from configured whitelist', () => {
      expect(validator.validate('https://ai-interview.dev/billing/success')).toBe(true);
      expect(validator.validate('http://localhost:3000/dashboard')).toBe(true);
    });
  });
});
