import { EmailEventsListener } from './email-events.listener';
import { EmailService } from '../email.service';

describe('EmailEventsListener', () => {
  let listener: EmailEventsListener;
  let emailService: jest.Mocked<Partial<EmailService>>;

  beforeEach(() => {
    emailService = {
      sendWelcomeEmail: jest.fn().mockResolvedValue({ id: 'job-1' } as any),
      sendInterviewCompletionEmail: jest.fn().mockResolvedValue({ id: 'job-2' } as any),
      sendPaymentReceiptEmail: jest.fn().mockResolvedValue({ id: 'job-3' } as any),
      sendStreakWarningEmail: jest.fn().mockResolvedValue({ id: 'job-4' } as any),
    };

    listener = new EmailEventsListener(emailService as EmailService);
  });

  it('handles auth.registered event and triggers sendWelcomeEmail', async () => {
    await listener.handleUserRegistered({
      userId: 'user-1',
      email: 'cand@example.com',
      fullName: 'John Doe',
    });

    expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
      'cand@example.com',
      'John Doe',
      'https://ai-interview.dev/setup',
      'vi',
    );
  });

  it('handles interview.completed event and triggers sendInterviewCompletionEmail', async () => {
    await listener.handleInterviewCompleted({
      userId: 'user-1',
      email: 'cand@example.com',
      userName: 'John Doe',
      sessionId: 'sess-123',
      jobRole: 'Backend Engineer',
      overallScore: 8.5,
      keyStrengths: ['Great code quality'],
      growthAreas: ['System design details'],
    });

    expect(emailService.sendInterviewCompletionEmail).toHaveBeenCalledWith(
      'cand@example.com',
      expect.objectContaining({
        userName: 'John Doe',
        jobRole: 'Backend Engineer',
        overallScore: 8.5,
        resultsUrl: 'https://ai-interview.dev/sessions/sess-123',
        keyStrengths: ['Great code quality'],
        growthAreas: ['System design details'],
        language: 'vi',
      }),
    );
  });

  it('handles billing.payment_succeeded event and triggers sendPaymentReceiptEmail', async () => {
    await listener.handlePaymentSucceeded({
      userId: 'user-1',
      email: 'cand@example.com',
      userName: 'John Doe',
      planName: 'PRO_MONTHLY',
      amount: 1990000,
      currency: 'VND',
      paymentMethod: 'VietQR (PayOS)',
      invoiceId: 'inv-123',
      paidAt: '2026-10-26T20:00:00Z',
    });

    expect(emailService.sendPaymentReceiptEmail).toHaveBeenCalledWith(
      'cand@example.com',
      expect.objectContaining({
        userName: 'John Doe',
        planName: 'PRO_MONTHLY',
        amount: 1990000,
        currency: 'VND',
        paymentMethod: 'VietQR (PayOS)',
        invoiceId: 'inv-123',
        paidAt: '2026-10-26T20:00:00Z',
        language: 'vi',
      }),
    );
  });

  it('handles streak.warning event and triggers sendStreakWarningEmail', async () => {
    await listener.handleStreakWarning({
      userId: 'user-1',
      email: 'cand@example.com',
      userName: 'John Doe',
      currentStreak: 5,
    });

    expect(emailService.sendStreakWarningEmail).toHaveBeenCalledWith(
      'cand@example.com',
      expect.objectContaining({
        userName: 'John Doe',
        currentStreak: 5,
        practiceUrl: 'https://ai-interview.dev/setup',
        language: 'vi',
      }),
    );
  });

  it('catches and logs errors without throwing unhandled rejection', async () => {
    (emailService.sendWelcomeEmail as jest.Mock).mockRejectedValue(
      new Error('Redis connection down'),
    );

    await expect(
      listener.handleUserRegistered({
        userId: 'user-1',
        email: 'cand@example.com',
        fullName: 'John Doe',
      }),
    ).resolves.toBeUndefined();
  });
});
