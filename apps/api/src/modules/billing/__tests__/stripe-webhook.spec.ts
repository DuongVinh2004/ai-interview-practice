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
    },
    $transaction: jest.fn(cb => (typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb))),
  };

  const secret = 'whsec_test_secret_1234567890';
  const mockConfigService = {
    get: jest.fn((key: string, defaultVal?: any) => {
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
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
    expect(mockPrisma.stripeEvent.upsert).toHaveBeenCalledWith({
      where: { id: 'evt_checkout_123' },
      update: { processed: true },
      create: expect.objectContaining({ id: 'evt_checkout_123', processed: true }),
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
