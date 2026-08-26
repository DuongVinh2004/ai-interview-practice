import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../email.service';

export interface UserRegisteredEvent {
  userId: string;
  email: string;
  fullName: string;
}

export interface InterviewCompletedEvent {
  userId: string;
  email: string;
  userName: string;
  sessionId: string;
  jobRole: string;
  overallScore: number;
  resultsUrl?: string;
  keyStrengths?: string[];
  growthAreas?: string[];
}

export interface PaymentSucceededEvent {
  userId: string;
  email: string;
  userName: string;
  planName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  invoiceId: string;
  paidAt?: string;
}

export interface StreakWarningEvent {
  userId: string;
  email: string;
  userName: string;
  currentStreak: number;
}

@Injectable()
export class EmailEventsListener {
  private readonly logger = new Logger(EmailEventsListener.name);

  constructor(private readonly emailService: EmailService) {}

  @OnEvent('auth.registered', { async: true })
  async handleUserRegistered(event: UserRegisteredEvent) {
    this.logger.log(`Received auth.registered event for ${event.email}`);
    try {
      await this.emailService.sendWelcomeEmail(
        event.email,
        event.fullName || 'Developer',
        'https://ai-interview.dev/setup',
        'vi',
      );
    } catch (err: any) {
      this.logger.error(`Failed to handle auth.registered event: ${err.message}`);
    }
  }

  @OnEvent('interview.completed', { async: true })
  async handleInterviewCompleted(event: InterviewCompletedEvent) {
    this.logger.log(`Received interview.completed event for session ${event.sessionId}`);
    try {
      await this.emailService.sendInterviewCompletionEmail(event.email, {
        userName: event.userName || 'Candidate',
        jobRole: event.jobRole || 'Software Engineer',
        overallScore: event.overallScore,
        resultsUrl: event.resultsUrl || `https://ai-interview.dev/sessions/${event.sessionId}`,
        keyStrengths: event.keyStrengths,
        growthAreas: event.growthAreas,
        language: 'vi',
      });
    } catch (err: any) {
      this.logger.error(`Failed to handle interview.completed event: ${err.message}`);
    }
  }

  @OnEvent('billing.payment_succeeded', { async: true })
  async handlePaymentSucceeded(event: PaymentSucceededEvent) {
    this.logger.log(`Received billing.payment_succeeded event for invoice ${event.invoiceId}`);
    try {
      await this.emailService.sendPaymentReceiptEmail(event.email, {
        userName: event.userName || 'Member',
        planName: event.planName,
        amount: event.amount,
        currency: event.currency,
        paymentMethod: event.paymentMethod,
        invoiceId: event.invoiceId,
        paidAt: event.paidAt,
        language: 'vi',
      });
    } catch (err: any) {
      this.logger.error(`Failed to handle billing.payment_succeeded event: ${err.message}`);
    }
  }

  @OnEvent('streak.warning', { async: true })
  async handleStreakWarning(event: StreakWarningEvent) {
    this.logger.log(`Received streak.warning event for user ${event.userId}`);
    try {
      await this.emailService.sendStreakWarningEmail(event.email, {
        userName: event.userName || 'Developer',
        currentStreak: event.currentStreak,
        practiceUrl: 'https://ai-interview.dev/setup',
        language: 'vi',
      });
    } catch (err: any) {
      this.logger.error(`Failed to handle streak.warning event: ${err.message}`);
    }
  }
}
