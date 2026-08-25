import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueName } from '@ai-interview/contracts';

describe('EmailService (Module B2)', () => {
  let service: EmailService;

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: getQueueToken(QueueName.EMAIL), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    jest.clearAllMocks();
  });

  it('enqueues welcome email', async () => {
    await service.sendWelcomeEmail('user@test.com', 'Test User');
    expect(mockQueue.add).toHaveBeenCalledWith(
      'welcome',
      expect.objectContaining({
        to: 'user@test.com',
        userName: 'Test User',
      }),
      expect.any(Object),
    );
  });

  it('enqueues interview completion email', async () => {
    await service.sendInterviewCompletionEmail('user@test.com', {
      userName: 'Test User',
      jobRole: 'DevOps Engineer',
      overallScore: 9.0,
      resultsUrl: 'https://ai-interview.dev/sessions/1',
    });
    expect(mockQueue.add).toHaveBeenCalledWith(
      'interview_completion',
      expect.objectContaining({
        to: 'user@test.com',
        jobRole: 'DevOps Engineer',
        overallScore: 9.0,
      }),
    );
  });

  it('enqueues payment receipt email', async () => {
    await service.sendPaymentReceiptEmail('user@test.com', {
      userName: 'Test User',
      planName: 'Pro Tier',
      amount: 500000,
      currency: 'VND',
      paymentMethod: 'PayOS VietQR',
      invoiceId: 'INV-100',
    });
    expect(mockQueue.add).toHaveBeenCalledWith(
      'payment_receipt',
      expect.objectContaining({
        to: 'user@test.com',
        amount: 500000,
        currency: 'VND',
      }),
    );
  });
});
