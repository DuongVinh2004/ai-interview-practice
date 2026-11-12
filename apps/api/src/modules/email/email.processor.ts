import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { renderEmail } from './render-email';
import { EmailProvider } from './interfaces/email-provider.interface';
import { WelcomeEmail } from './templates/WelcomeEmail';
import { InterviewCompletionEmail } from './templates/InterviewCompletionEmail';
import { StreakWarningEmail } from './templates/StreakWarningEmail';
import { PaymentReceiptEmail } from './templates/PaymentReceiptEmail';
import { PasswordResetEmail } from './templates/PasswordResetEmail';
import { EmailVerificationEmail } from './templates/EmailVerificationEmail';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(@Inject('EMAIL_PROVIDER') private readonly emailProvider: EmailProvider) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(
      `Processing email job ID: ${job.id}, Type: ${job.name}, Target: ${job.data?.to}`,
    );

    let html = '';
    let subject = job.data?.subject || 'AI Interview Practice Notification';

    const lang = job.data?.language || 'vi';

    switch (job.name) {
      case 'welcome':
        html = renderEmail(
          WelcomeEmail({
            userName: job.data.userName || 'Member',
            loginUrl: job.data.loginUrl || 'https://ai-interview.dev/login',
            language: lang,
          }),
        );
        if (!job.data?.subject) {
          subject =
            lang === 'vi'
              ? '🎉 Chào mừng đến với AI Interview Practice!'
              : '🎉 Welcome to AI Interview Practice!';
        }
        break;

      case 'interview_completion':
        html = renderEmail(
          InterviewCompletionEmail({
            userName: job.data.userName || 'Candidate',
            jobRole: job.data.jobRole || 'Software Engineer',
            overallScore: Number(job.data.overallScore) || 0,
            resultsUrl: job.data.resultsUrl || 'https://ai-interview.dev/history',
            keyStrengths: job.data.keyStrengths,
            growthAreas: job.data.growthAreas,
            language: lang,
          }),
        );
        if (!job.data?.subject) {
          subject =
            lang === 'vi'
              ? `📊 Kết quả phỏng vấn vị trí ${job.data.jobRole || 'Kỹ sư'} (${job.data.overallScore || 0}/10)`
              : `📊 Interview Results for ${job.data.jobRole || 'Engineer'} (${job.data.overallScore || 0}/10)`;
        }
        break;

      case 'streak_warning':
        html = renderEmail(
          StreakWarningEmail({
            userName: job.data.userName || 'Member',
            currentStreak: Number(job.data.currentStreak) || 1,
            practiceUrl: job.data.practiceUrl || 'https://ai-interview.dev/setup',
            language: lang,
          }),
        );
        if (!job.data?.subject) {
          subject =
            lang === 'vi'
              ? `🔥 Cảnh báo: Bảo vệ chuỗi ${job.data.currentStreak || 1} ngày luyện tập của bạn!`
              : `🔥 Warning: Protect your ${job.data.currentStreak || 1}-day practice streak!`;
        }
        break;

      case 'payment_receipt':
        html = renderEmail(
          PaymentReceiptEmail({
            userName: job.data.userName || 'Member',
            planName: job.data.planName || 'Pro Plan',
            amount: Number(job.data.amount) || 0,
            currency: job.data.currency || 'USD',
            paymentMethod: job.data.paymentMethod || 'VietQR',
            invoiceId: job.data.invoiceId || 'INV-001',
            paidAt: job.data.paidAt || new Date().toISOString().split('T')[0],
            dashboardUrl: job.data.dashboardUrl || 'https://ai-interview.dev/billing',
            language: lang,
          }),
        );
        if (!job.data?.subject) {
          subject =
            lang === 'vi'
              ? `🧾 Biên lai thanh toán thành công - Gói ${job.data.planName || 'Dịch vụ'}`
              : `🧾 Payment Confirmation & Receipt - ${job.data.planName || 'Plan'}`;
        }
        break;

      case 'password_reset':
        html = renderEmail(
          PasswordResetEmail({
            userName: job.data.userName || 'Developer',
            resetUrl: job.data.resetUrl,
            expiresInMinutes: job.data.expiresInMinutes || 60,
            language: lang,
          }),
        );
        if (!job.data?.subject) {
          subject =
            lang === 'vi'
              ? '🔒 Đặt lại mật khẩu tài khoản AI Interview Practice'
              : '🔒 Reset your AI Interview Practice password';
        }
        break;

      case 'email_verification':
        html = renderEmail(
          EmailVerificationEmail({
            userName: job.data.userName || 'Developer',
            verificationUrl: job.data.verificationUrl,
            expiresInHours: job.data.expiresInHours || 24,
            language: lang,
          }),
        );
        if (!job.data?.subject) {
          subject =
            lang === 'vi'
              ? '✉️ Xác thực địa chỉ email tài khoản AI Interview Practice'
              : '✉️ Verify your AI Interview Practice email';
        }
        break;

      default:
        this.logger.warn(`Unknown email job template: ${job.name}, using raw HTML if provided`);
        html = job.data?.html || `<p>${job.data?.text || 'Notification from AI Interview'}</p>`;
    }

    return this.emailProvider.sendEmail({
      to: job.data.to,
      subject,
      html,
      text: job.data?.text,
    });
  }
}
