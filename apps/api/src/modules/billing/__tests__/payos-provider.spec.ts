import { Test, TestingModule } from '@nestjs/testing';
import { PayosProvider } from '../providers/payos.provider';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

describe('PayosProvider (Module B4)', () => {
  let provider: PayosProvider;
  const checksumKey = 'test_checksum_key_1234567890123456';

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'billing.payosClientId') return 'mock-client-id';
      if (key === 'billing.payosApiKey') return 'mock-api-key';
      if (key === 'billing.payosChecksumKey') return checksumKey;
      return null;
    }),
  };

  const createPayosSignature = (data: Record<string, any>, key: string): string => {
    const sortedKeys = Object.keys(data).sort();
    const queryString = sortedKeys
      .map(k => {
        const val = data[k];
        return `${k}=${val !== null && val !== undefined ? val : ''}`;
      })
      .join('&');
    return crypto.createHmac('sha256', key).update(queryString).digest('hex');
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PayosProvider, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    provider = module.get<PayosProvider>(PayosProvider);
  });

  it('creates mock VietQR payment link with valid banking details in non-production', async () => {
    const result = await provider.createPaymentLink({
      orderCode: 123456,
      amount: 499000,
      description: 'AI INT PRO',
      returnUrl: 'https://ai-interview.dev/success',
      cancelUrl: 'https://ai-interview.dev/cancel',
    });

    expect(result.orderCode).toBe(123456);
    expect(result.amount).toBe(499000);
    expect(result.checkoutUrl).toContain('123456');
    expect(result.accountNumber).toBeDefined();
    expect(result.bin).toBe('970422');
  });

  it('fails closed when creating payment link in production without valid credentials', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const unconfiguredProvider = new PayosProvider({
        get: jest.fn().mockReturnValue(''),
      } as any);

      await expect(
        unconfiguredProvider.createPaymentLink({
          orderCode: 123456,
          amount: 499000,
          description: 'AI INT PRO',
          returnUrl: 'https://ai-interview.dev/success',
          cancelUrl: 'https://ai-interview.dev/cancel',
        }),
      ).rejects.toMatchObject({
        message: 'VietQR payment processing is currently unavailable',
        status: 503,
      });
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('verifies valid signed webhook data successfully', async () => {
    const data = {
      accountNumber: '0987654321',
      amount: 499000,
      code: '00',
      currency: 'VND',
      desc: 'success',
      description: 'AI INT PRO',
      orderCode: 123456,
      paymentLinkId: 'link_123',
      reference: 'FT26001234',
      transactionDateTime: '2026-08-25 15:00:00',
    };

    const signature = createPayosSignature(data, checksumKey);

    const webhookPayload = {
      code: '00',
      desc: 'success',
      data,
      signature,
    };

    const verified = await provider.verifyWebhookData(webhookPayload);
    expect(verified).toBeDefined();
    expect(verified.orderCode).toBe(123456);
    expect(verified.amount).toBe(499000);
  });

  it('rejects webhook payload when missing signature (fails closed)', async () => {
    const webhookPayload = {
      code: '00',
      desc: 'success',
      data: {
        orderCode: 123456,
        amount: 499000,
      },
    };

    const verified = await provider.verifyWebhookData(webhookPayload);
    expect(verified).toBeNull();
  });

  it('rejects webhook payload when missing data (fails closed)', async () => {
    const webhookPayload = {
      code: '00',
      desc: 'success',
      signature: 'some_sig',
    };

    const verified = await provider.verifyWebhookData(webhookPayload);
    expect(verified).toBeNull();
  });

  it('rejects webhook payload with forged / invalid signature (fails closed)', async () => {
    const data = {
      accountNumber: '0987654321',
      amount: 499000,
      code: '00',
      currency: 'VND',
      desc: 'success',
      description: 'AI INT PRO',
      orderCode: 123456,
      paymentLinkId: 'link_123',
      reference: 'FT26001234',
      transactionDateTime: '2026-08-25 15:00:00',
    };

    const webhookPayload = {
      code: '00',
      desc: 'success',
      data,
      signature: 'forged_tampered_signature_hex_12345',
    };

    const verified = await provider.verifyWebhookData(webhookPayload);
    expect(verified).toBeNull();
  });

  it('rejects webhook verification when provider is not configured (fails closed)', async () => {
    const unconfiguredProvider = new PayosProvider({
      get: jest.fn().mockReturnValue(''),
    } as any);

    const data = {
      orderCode: 123456,
      amount: 499000,
      code: '00',
    };

    const webhookPayload = {
      code: '00',
      desc: 'success',
      data,
      signature: 'some_sig',
    };

    const verified = await unconfiguredProvider.verifyWebhookData(webhookPayload);
    expect(verified).toBeNull();
  });
});
