import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS } from '@payos/node';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ErrorCode } from '@ai-interview/contracts';

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
      this.configService.get<string>('billing.payosClientId') || process.env.PAYOS_CLIENT_ID || '';
    const apiKey =
      this.configService.get<string>('billing.payosApiKey') || process.env.PAYOS_API_KEY || '';
    const checksumKey =
      this.configService.get<string>('billing.payosChecksumKey') ||
      process.env.PAYOS_CHECKSUM_KEY ||
      '';

    const isProduction =
      process.env.NODE_ENV === 'production' ||
      this.configService.get<string>('app.env') === 'production' ||
      this.configService.get<string>('NODE_ENV') === 'production';

    const hasKeys = Boolean(clientId && apiKey && checksumKey);
    const hasMockKeys = clientId.includes('mock') || apiKey.includes('mock');

    if (isProduction && hasMockKeys) {
      this.isConfigured = false;
    } else {
      this.isConfigured = hasKeys;
    }

    if (this.isConfigured) {
      try {
        this.payos = new PayOS({
          clientId,
          apiKey,
          checksumKey,
        });
        this.logger.log('PayOS VietQR SDK initialized successfully.');
      } catch (err: any) {
        this.logger.warn(`Failed to initialize PayOS SDK: ${err.message}`);
        this.isConfigured = false;
      }
    } else {
      this.logger.log('PayOS credentials not configured or in mock mode. Running Mock VietQR.');
    }
  }

  isConfiguredProvider(): boolean {
    return Boolean(this.isConfigured && this.payos);
  }

  async createPaymentLink(params: PayosCreatePaymentParams): Promise<PayosPaymentResponse> {
    const isProduction =
      process.env.NODE_ENV === 'production' ||
      this.configService.get<string>('app.env') === 'production' ||
      this.configService.get<string>('NODE_ENV') === 'production';

    const clientId =
      this.configService.get<string>('billing.payosClientId') || process.env.PAYOS_CLIENT_ID || '';
    const isMockMode = clientId.includes('mock') || !this.isConfigured || !this.payos;

    if (this.isConfigured && this.payos && !isMockMode) {
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

    if (isProduction) {
      this.logger.error('PayOS is not configured for production payment link creation');
      throw new DomainException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'VietQR payment processing is currently unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Mock PayOS VietQR Response for non-production environments
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

  async verifyWebhookData(webhookBody: any): Promise<any> {
    if (!webhookBody || !webhookBody.data || !webhookBody.signature) {
      this.logger.warn('PayOS webhook missing data or signature payload');
      return null;
    }

    if (this.isConfigured && this.payos) {
      try {
        const verifiedData = await this.payos.webhooks.verify(webhookBody);
        return verifiedData;
      } catch (err: any) {
        this.logger.warn(`PayOS webhook signature verification failed: ${err.message}`);
        return null;
      }
    }

    this.logger.warn(
      'PayOS provider is not configured; rejecting webhook verification fail-closed',
    );
    return null;
  }
}
