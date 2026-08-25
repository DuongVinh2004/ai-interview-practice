import { Test, TestingModule } from '@nestjs/testing';
import { PayosProvider } from '../providers/payos.provider';
import { ConfigService } from '@nestjs/config';

describe('PayosProvider (Module B4)', () => {
  let provider: PayosProvider;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'billing.payosClientId') return 'mock-client';
      if (key === 'billing.payosApiKey') return 'mock-key';
      if (key === 'billing.payosChecksumKey') return 'mock-checksum';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayosProvider,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    provider = module.get<PayosProvider>(PayosProvider);
  });

  it('creates mock VietQR payment link with valid banking details', async () => {
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

  it('verifies mock webhook data successfully', () => {
    const webhookPayload = {
      code: '00',
      desc: 'success',
      data: {
        orderCode: 123456,
        amount: 499000,
        description: 'AI INT PRO',
        accountNumber: '0987654321',
        reference: 'FT26001234',
        transactionDateTime: '2026-08-25 15:00:00',
        currency: 'VND',
        paymentLinkId: 'link_123',
        code: '00',
      },
      signature: 'mock_signature_hash',
    };

    const verified = provider.verifyWebhookData(webhookPayload);
    expect(verified).toBeDefined();
    expect(verified.orderCode).toBe(123456);
    expect(verified.amount).toBe(499000);
  });
});
