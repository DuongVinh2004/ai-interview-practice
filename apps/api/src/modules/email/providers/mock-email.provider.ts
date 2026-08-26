import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import {
  EmailProvider,
  EmailSendOptions,
  EmailSendResponse,
} from '../interfaces/email-provider.interface';
import { ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

@Injectable()
export class MockEmailProvider implements EmailProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockEmailProvider.name);
  readonly sentEmails: EmailSendOptions[] = [];

  private checkProductionGuard() {
    const isProduction =
      process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
    const allowMock = process.env.ALLOW_MOCK_PROVIDERS === 'true';

    if (isProduction && !allowMock) {
      this.logger.error(
        'MockEmailProvider invoked in production without ALLOW_MOCK_PROVIDERS=true',
      );
      throw new DomainException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Email notification service is currently unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async sendEmail(options: EmailSendOptions): Promise<EmailSendResponse> {
    this.checkProductionGuard();
    const emailId = `mock-email-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    this.sentEmails.push(options);

    this.logger.log(
      `📧 [MOCK EMAIL DISPATCHED] ID: ${emailId}\n` +
        `   To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}\n` +
        `   Subject: ${options.subject}\n` +
        `   HTML Length: ${options.html?.length || 0} bytes`,
    );

    return {
      id: emailId,
      provider: 'mock',
      success: true,
    };
  }

  clear() {
    this.sentEmails.length = 0;
  }
}
