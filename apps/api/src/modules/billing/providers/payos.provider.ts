import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS } from '@payos/node';

export interface PayosCreatePaymentParams {
  orderCode: number;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
}

export interface PayosPaymentResponse {
  orderCode: number;
  checkoutUrl: string;
  qrCode: string;
  accountNumber?: string;
  accountName?: string;
  bin?: string;
  amount: number;
  description?: string;
  status: string;
  currency: string;
}

@Injectable()
export class PayosProvider {
  private readonly logger = new Logger(PayosProvider.name);
  private readonly payos: PayOS | null = null;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const clientId =
      this.configService.get<string>('billing.payosClientId') ||
      process.env.PAYOS_CLIENT_ID ||
      '';
    const apiKey =
      this.configService.get<string>('billing.payosApiKey') ||
      process.env.PAYOS_API_KEY ||
      '';
    const checksumKey =
      this.configService.get<string>('billing.payosChecksumKey') ||
      process.env.PAYOS_CHECKSUM_KEY ||
      '';

    this.isConfigured = Boolean(
      clientId &&
      apiKey &&
      checksumKey &&
      !clientId.includes('mock') &&
      !apiKey.includes('mock'),
    );

    if (this.isConfigured) {
      try {
        this.payos = new PayOS({
          clientId,
          apiKey,
          checksumKey,
        });
        this.logger.log('PayOS VietQR SDK initialized successfully.');
      } catch (err: any) {
        this.logger.warn(`Failed to initialize PayOS SDK, falling back to mock: ${err.message}`);
        this.isConfigured = false;
      }
    } else {
      this.logger.log('PayOS credentials not configured or in mock mode. Running Mock VietQR.');
    }
  }

  async createPaymentLink(params: PayosCreatePaymentParams): Promise<PayosPaymentResponse> {
    if (this.isConfigured && this.payos) {
      try {
        const response: any = await this.payos.paymentRequests.create({
          orderCode: params.orderCode,
          amount: params.amount,
          description: params.description.slice(0, 25), // PayOS limit 25 chars
          returnUrl: params.returnUrl,
          cancelUrl: params.cancelUrl,
          items: params.items,
        });

        return {
          orderCode: response.orderCode,
          checkoutUrl: response.checkoutUrl,
          qrCode: response.qrCode,
          accountNumber: response.accountNumber,
          accountName: response.accountName,
          bin: response.bin,
          amount: response.amount,
          description: response.description,
          status: response.status || 'PENDING',
          currency: 'VND',
        };
      } catch (err: any) {
        this.logger.error(`PayOS createPaymentLink error: ${err.message}`);
        throw err;
      }
    }

    // Mock PayOS VietQR Response
    const mockBin = '970422'; // MBBank BIN
    const mockAccountNumber = '0987654321';
    const mockAccountName = 'AI INTERVIEW PRACTICE';
    const mockQrCode = `00020101021238540010A00000072701240006${mockBin}0110${mockAccountNumber}520459995303704540${params.amount}5802VN62180814${params.orderCode}6304ABCD`;

    return {
      orderCode: params.orderCode,
      checkoutUrl: `https://pay.payos.vn/web/mock-${params.orderCode}`,
      qrCode: mockQrCode,
      accountNumber: mockAccountNumber,
      accountName: mockAccountName,
      bin: mockBin,
      amount: params.amount,
      description: params.description.slice(0, 25),
      status: 'PENDING',
      currency: 'VND',
    };
  }

  verifyWebhookData(webhookBody: any): any {
    if (this.isConfigured && this.payos) {
      return this.payos.webhooks.verify(webhookBody);
    }
    // Mock verification: accept valid structured webhook
    if (webhookBody && webhookBody.data) {
      return webhookBody.data;
    }
    return webhookBody;
  }
}
