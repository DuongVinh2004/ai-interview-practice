import { renderEmail } from './render-email';
import { WelcomeEmail } from './templates/WelcomeEmail';
import { InterviewCompletionEmail } from './templates/InterviewCompletionEmail';
import { StreakWarningEmail } from './templates/StreakWarningEmail';
import { PaymentReceiptEmail } from './templates/PaymentReceiptEmail';
import { PasswordResetEmail } from './templates/PasswordResetEmail';
import { EmailVerificationEmail } from './templates/EmailVerificationEmail';

describe('React Email Templates Rendering (Module B2)', () => {
  it('renders WelcomeEmail in Vietnamese and English', async () => {
    const htmlVi = renderEmail(
      WelcomeEmail({
        userName: 'Nam Nguyen',
        loginUrl: 'https://ai-interview.dev',
        language: 'vi',
      }),
    );
    expect(htmlVi).toContain('Nam Nguyen');
    expect(htmlVi).toContain('Chào mừng');

    const htmlEn = renderEmail(
      WelcomeEmail({ userName: 'John Doe', loginUrl: 'https://ai-interview.dev', language: 'en' }),
    );
    expect(htmlEn).toContain('John Doe');
    expect(htmlEn).toContain('Welcome to AI Interview');
  });

  it('renders InterviewCompletionEmail with scores and review items', async () => {
    const html = renderEmail(
      InterviewCompletionEmail({
        userName: 'Elena Rostova',
        jobRole: 'Staff Architect',
        overallScore: 9.2,
        resultsUrl: 'https://ai-interview.dev/results',
        keyStrengths: ['Strong domain modeling'],
        growthAreas: ['Refine event sourcing replay'],
        language: 'vi',
      }),
    );
    expect(html).toContain('Elena Rostova');
    expect(html).toContain('9.2');
    expect(html).toContain('Staff Architect');
    expect(html).toContain('Strong domain modeling');
  });

  it('renders StreakWarningEmail with current streak count', async () => {
    const html = renderEmail(
      StreakWarningEmail({
        userName: 'Duong Vinh',
        currentStreak: 12,
        practiceUrl: 'https://ai-interview.dev/setup',
        language: 'vi',
      }),
    );
    expect(html).toContain('12');
    expect(html).toContain('Duong Vinh');
    expect(html).toContain('Streak');
  });

  it('renders PaymentReceiptEmail with VietQR and USD/VND formatting', async () => {
    const htmlVnd = renderEmail(
      PaymentReceiptEmail({
        userName: 'Vinh Duong',
        planName: 'Pro Tier (Yearly)',
        amount: 1990000,
        currency: 'VND',
        paymentMethod: 'VietQR (PayOS)',
        invoiceId: 'INV-VN-2026',
        paidAt: '2026-08-25',
        dashboardUrl: 'https://ai-interview.dev/billing',
        language: 'vi',
      }),
    );
    expect(htmlVnd).toContain('INV-VN-2026');
    expect(htmlVnd).toContain('1.990.000 VND');
    expect(htmlVnd).toContain('VietQR (PayOS)');
  });

  it('renders PasswordResetEmail in Vietnamese and English', async () => {
    const htmlVi = renderEmail(
      PasswordResetEmail({
        userName: 'Minh Tran',
        resetUrl: 'https://ai-interview.dev/reset-password?token=xyz123',
        expiresInMinutes: 60,
        language: 'vi',
      }),
    );
    expect(htmlVi).toContain('Minh Tran');
    expect(htmlVi).toContain('Đặt Lại Mật Khẩu');
    expect(htmlVi).toContain('xyz123');

    const htmlEn = renderEmail(
      PasswordResetEmail({
        userName: 'Jane Doe',
        resetUrl: 'https://ai-interview.dev/reset-password?token=abc456',
        expiresInMinutes: 30,
        language: 'en',
      }),
    );
    expect(htmlEn).toContain('Jane Doe');
    expect(htmlEn).toContain('Password Reset');
    expect(htmlEn).toContain('abc456');
  });

  it('renders EmailVerificationEmail in Vietnamese and English', async () => {
    const htmlVi = renderEmail(
      EmailVerificationEmail({
        userName: 'Minh Tran',
        verificationUrl: 'https://ai-interview.dev/verify-email?token=ver123',
        expiresInHours: 24,
        language: 'vi',
      }),
    );
    expect(htmlVi).toContain('Minh Tran');
    expect(htmlVi).toContain('Xác thực');
    expect(htmlVi).toContain('ver123');

    const htmlEn = renderEmail(
      EmailVerificationEmail({
        userName: 'Jane Doe',
        verificationUrl: 'https://ai-interview.dev/verify-email?token=ver456',
        expiresInHours: 48,
        language: 'en',
      }),
    );
    expect(htmlEn).toContain('Jane Doe');
    expect(htmlEn).toContain('Verify');
    expect(htmlEn).toContain('ver456');
  });
});
