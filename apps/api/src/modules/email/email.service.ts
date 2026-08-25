import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueName } from '@ai-interview/contracts';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(@InjectQueue(QueueName.EMAIL) private readonly emailQueue: Queue) {}

  async sendWelcomeEmail(
    to: string,
    userName: string,
    loginUrl = 'https://ai-interview.dev/login',
    language: 'vi' | 'en' = 'vi',
  ) {
    this.logger.log(`Enqueuing welcome email to ${to}`);
    return this.emailQueue.add(
      'welcome',
      {
        to,
        userName,
        loginUrl,
        language,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  }

  async sendInterviewCompletionEmail(
    to: string,
    data: {
      userName: string;
      jobRole: string;
      overallScore: number;
      resultsUrl: string;
      keyStrengths?: string[];
      growthAreas?: string[];
      language?: 'vi' | 'en';
    },
  ) {
    this.logger.log(`Enqueuing interview completion email to ${to}`);
    return this.emailQueue.add('interview_completion', { to, ...data });
  }

  async sendStreakWarningEmail(
    to: string,
    data: {
      userName: string;
      currentStreak: number;
      practiceUrl?: string;
      language?: 'vi' | 'en';
    },
  ) {
    this.logger.log(`Enqueuing streak warning email to ${to}`);
    return this.emailQueue.add('streak_warning', { to, ...data });
  }

  async sendPaymentReceiptEmail(
    to: string,
    data: {
      userName: string;
      planName: string;
      amount: number;
      currency: string;
      paymentMethod: string;
      invoiceId: string;
      paidAt?: string;
      dashboardUrl?: string;
      language?: 'vi' | 'en';
    },
  ) {
    this.logger.log(`Enqueuing payment receipt email to ${to}`);
    return this.emailQueue.add('payment_receipt', { to, ...data });
  }

  async sendCustomEmail(to: string, subject: string, html: string, text?: string) {
    this.logger.log(`Enqueuing custom email to ${to}: ${subject}`);
    return this.emailQueue.add('custom', { to, subject, html, text });
  }
}
