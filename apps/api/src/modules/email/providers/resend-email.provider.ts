import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  EmailProvider,
  EmailSendOptions,
  EmailSendResponse,
} from '../interfaces/email-provider.interface';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly resend: Resend;
  private readonly defaultFrom: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('email.resendApiKey') ||
      process.env.RESEND_API_KEY ||
      're_mock_key';
    this.resend = new Resend(apiKey);
    this.defaultFrom =
      this.configService.get<string>('email.defaultFrom') ||
      process.env.EMAIL_DEFAULT_FROM ||
      'AI Interview <noreply@ai-interview.com>';
  }

  async sendEmail(options: EmailSendOptions): Promise<EmailSendResponse> {
    try {
      const response = await this.resend.emails.send({
        from: options.from || this.defaultFrom,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        attachments: options.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
        })),
      });

      if (response.error) {
        this.logger.error(`Resend API Error: ${response.error.message}`);
        throw new Error(`Resend Error: ${response.error.message}`);
      }

      this.logger.log(`Email dispatched via Resend: ID ${response.data?.id}`);
      return {
        id: response.data?.id || 'resend-id',
        provider: 'resend',
        success: true,
      };
    } catch (error: any) {
      this.logger.error(`Failed to send email via Resend: ${error.message}`);
      throw error;
    }
  }
}
