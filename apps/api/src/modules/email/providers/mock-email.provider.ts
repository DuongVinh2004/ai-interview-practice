import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider, EmailSendOptions, EmailSendResponse } from '../interfaces/email-provider.interface';

@Injectable()
export class MockEmailProvider implements EmailProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockEmailProvider.name);
  readonly sentEmails: EmailSendOptions[] = [];

  async sendEmail(options: EmailSendOptions): Promise<EmailSendResponse> {
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
