import { Test, TestingModule } from '@nestjs/testing';
import { EmailProcessor } from './email.processor';
import { MockEmailProvider } from './providers/mock-email.provider';
import { Job } from 'bullmq';

describe('EmailProcessor (Module B2)', () => {
  let processor: EmailProcessor;
  let mockProvider: MockEmailProvider;

  beforeEach(async () => {
    mockProvider = new MockEmailProvider();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        { provide: 'EMAIL_PROVIDER', useValue: mockProvider },
      ],
    }).compile();

    processor = module.get<EmailProcessor>(EmailProcessor);
  });

  it('processes welcome email job and dispatches email', async () => {
    const job = {
      id: 'job-1',
      name: 'welcome',
      data: {
        to: 'candidate@example.com',
        userName: 'Alex Johnson',
        loginUrl: 'https://ai-interview.dev/login',
        language: 'vi',
      },
    } as Job;

    const result = await processor.process(job);
    expect(result.success).toBe(true);
    expect(mockProvider.sentEmails.length).toBe(1);
    expect(mockProvider.sentEmails[0].to).toBe('candidate@example.com');
    expect(mockProvider.sentEmails[0].html).toContain('Alex Johnson');
  });

  it('processes interview_completion email job', async () => {
    const job = {
      id: 'job-2',
      name: 'interview_completion',
      data: {
        to: 'candidate@example.com',
        userName: 'Alex Johnson',
        jobRole: 'Senior Backend Engineer',
        overallScore: 8.7,
        resultsUrl: 'https://ai-interview.dev/sessions/123',
        keyStrengths: ['Great caching strategy'],
        growthAreas: ['Database sharding'],
        language: 'en',
      },
    } as Job;

    const result = await processor.process(job);
    expect(result.success).toBe(true);
    expect(mockProvider.sentEmails.length).toBe(1);
    expect(mockProvider.sentEmails[0].subject).toContain('8.7');
    expect(mockProvider.sentEmails[0].html).toContain('Senior Backend Engineer');
  });

  it('processes streak_warning email job', async () => {
    const job = {
      id: 'job-3',
      name: 'streak_warning',
      data: {
        to: 'candidate@example.com',
        userName: 'Alex Johnson',
        currentStreak: 7,
        practiceUrl: 'https://ai-interview.dev/setup',
        language: 'vi',
      },
    } as Job;

    const result = await processor.process(job);
    expect(result.success).toBe(true);
    expect(mockProvider.sentEmails.length).toBe(1);
    expect(mockProvider.sentEmails[0].html).toContain('7');
  });

  it('processes payment_receipt email job', async () => {
    const job = {
      id: 'job-4',
      name: 'payment_receipt',
      data: {
        to: 'candidate@example.com',
        userName: 'Alex Johnson',
        planName: 'Pro Plan',
        amount: 19.99,
        currency: 'USD',
        paymentMethod: 'VietQR (PayOS)',
        invoiceId: 'INV-2026-999',
        dashboardUrl: 'https://ai-interview.dev/billing',
        language: 'vi',
      },
    } as Job;

    const result = await processor.process(job);
    expect(result.success).toBe(true);
    expect(mockProvider.sentEmails.length).toBe(1);
    expect(mockProvider.sentEmails[0].html).toContain('INV-2026-999');
    expect(mockProvider.sentEmails[0].html).toContain('19.99');
  });
});
