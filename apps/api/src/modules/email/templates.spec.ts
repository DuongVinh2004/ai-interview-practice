import { renderEmail } from './render-email';
import { WelcomeEmail } from './templates/WelcomeEmail';
import { InterviewCompletionEmail } from './templates/InterviewCompletionEmail';
import { StreakWarningEmail } from './templates/StreakWarningEmail';
import { PaymentReceiptEmail } from './templates/PaymentReceiptEmail';

describe('React Email Templates Rendering (Module B2)', () => {
  it('renders WelcomeEmail in Vietnamese and English', async () => {
    const htmlVi = renderEmail(
      WelcomeEmail({ userName: 'Nam Nguyen', loginUrl: 'https://ai-interview.dev', language: 'vi' }),
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
});
