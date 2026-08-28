import { QuestionBankService } from '../services/question-bank.service';
import { QuestionPublicationStatus } from '@ai-interview/contracts';

describe('QuestionBank Concurrency & Idempotency', () => {
  let service: QuestionBankService;
  let mockPrisma: any;
  let mockEntitlement: any;
  let mockReservations: any;

  beforeEach(() => {
    mockPrisma = {
      questionBankQuestion: {
        findUnique: jest.fn(),
      },
      questionAnswerAccessGrant: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      questionBankUsageLedger: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async cb => cb(mockPrisma)),
    };

    mockEntitlement = {
      getEffectiveEntitlement: jest.fn().mockResolvedValue({
        accessPeriodKey: 'month_2026-08',
        revealsLimit: 5,
        revealsUsed: 0,
        revealsRemaining: 5,
        periodResetsAt: '2026-09-01T00:00:00.000Z',
      }),
    };
    mockReservations = {
      getPolicyInTransaction: jest.fn().mockResolvedValue({ accessPeriodKey: 'month_2026-08' }),
      reserveInTransaction: jest.fn(),
      commitInTransaction: jest.fn(),
    };

    service = new QuestionBankService(mockPrisma, mockEntitlement, mockReservations);
  });

  it('handles race condition when duplicate request arrives concurrently with same idempotency key', async () => {
    mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
      id: 'q_123',
      status: QuestionPublicationStatus.PUBLISHED,
      answers: [
        {
          id: 'ans_123',
          questionId: 'q_123',
          version: 1,
          authority: 'REFERENCE',
          answerBody: 'Concurrent answer body',
          isPublished: true,
          createdAt: new Date(),
        },
      ],
    });

    // Simulate first request already committed the grant in the transaction
    mockPrisma.questionAnswerAccessGrant.findUnique.mockResolvedValue({
      id: 'grant_concurrent_1',
      userId: 'user_1',
      questionId: 'q_123',
      answerId: 'ans_123',
      idempotencyKey: 'idem-key-duplicate',
    });

    const response = await service.revealAnswer('q_123', 'user_1', 'idem-key-duplicate');

    expect(response.meta.access).toBe('existing_grant');
    expect(mockPrisma.questionAnswerAccessGrant.create).not.toHaveBeenCalled();
    expect(mockPrisma.questionBankUsageLedger.create).not.toHaveBeenCalled();
  });
});
