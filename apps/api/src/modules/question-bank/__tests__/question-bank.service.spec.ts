import { QuestionBankService } from '../services/question-bank.service';
import { QuestionPublicationStatus, QuestionFeedbackReason } from '@ai-interview/contracts';

describe('QuestionBankService Integration', () => {
  let service: QuestionBankService;
  let mockPrisma: any;
  let mockEntitlement: any;
  let mockReservations: any;

  beforeEach(() => {
    mockPrisma = {
      questionBankQuestion: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      questionBankAnswer: {
        create: jest.fn(),
        update: jest.fn(),
      },
      questionBankTechnology: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      questionAnswerAccessGrant: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      questionBankUsageLedger: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      questionBookmark: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      questionFeedback: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(cb => cb(mockPrisma)),
    };

    mockEntitlement = {
      getEffectiveEntitlement: jest.fn().mockResolvedValue({
        accessPeriodKey: 'month_2026-08',
        revealsLimit: 5,
        revealsUsed: 1,
        revealsRemaining: 4,
        periodResetsAt: '2026-09-01T00:00:00.000Z',
      }),
      canRevealAnswer: jest.fn().mockResolvedValue({
        allowed: true,
        existingGrant: false,
        entitlement: {
          accessPeriodKey: 'month_2026-08',
          revealsLimit: 5,
          revealsUsed: 1,
          revealsRemaining: 4,
          periodResetsAt: '2026-09-01T00:00:00.000Z',
        },
      }),
    };
    mockReservations = {
      getPolicyInTransaction: jest.fn().mockResolvedValue({ accessPeriodKey: 'month_2026-08' }),
      reserveInTransaction: jest.fn().mockResolvedValue({
        id: 'reservation_123',
        accessPeriodKey: 'month_2026-08',
        state: 'RESERVED',
        isNewReservation: true,
      }),
      commitInTransaction: jest.fn().mockResolvedValue({ state: 'COMMITTED' }),
    };

    service = new QuestionBankService(mockPrisma, mockEntitlement, mockReservations);
  });

  describe('revealAnswer', () => {
    it('creates grant, usage ledger and audit log for new reveal', async () => {
      mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
        id: 'q_123',
        status: QuestionPublicationStatus.PUBLISHED,
        answers: [
          {
            id: 'ans_123',
            questionId: 'q_123',
            version: 1,
            authority: 'REFERENCE',
            answerBody: 'Full answer text',
            isPublished: true,
            createdAt: new Date(),
          },
        ],
      });

      mockPrisma.questionAnswerAccessGrant.findUnique.mockResolvedValue(null);
      mockPrisma.questionAnswerAccessGrant.create.mockResolvedValue({
        id: 'grant_123',
        userId: 'user_1',
      });
      mockPrisma.questionBankUsageLedger.create.mockResolvedValue({
        id: 'usage_123',
      });

      const result = await service.revealAnswer('q_123', 'user_1', 'idem-uuid-1');

      expect(result.meta.access).toBe('new_grant');
      expect(result.data.answerBody).toBe('Full answer text');
      expect(result.meta.quota.used).toBe(1);
      expect(result.meta.quota.remaining).toBe(4);
      expect(mockPrisma.questionAnswerAccessGrant.create).toHaveBeenCalled();
      expect(mockPrisma.questionBankUsageLedger.create).toHaveBeenCalled();
    });

    it('returns existing grant without adding ledger record when answer already revealed', async () => {
      mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
        id: 'q_123',
        status: QuestionPublicationStatus.PUBLISHED,
        answers: [
          {
            id: 'ans_123',
            questionId: 'q_123',
            version: 1,
            authority: 'REFERENCE',
            answerBody: 'Full answer text',
            isPublished: true,
            createdAt: new Date(),
          },
        ],
      });

      mockPrisma.questionAnswerAccessGrant.findUnique.mockResolvedValue({
        id: 'grant_existing',
        userId: 'user_1',
        questionId: 'q_123',
        answerId: 'ans_123',
      });

      const result = await service.revealAnswer('q_123', 'user_1', 'idem-uuid-2');

      expect(result.meta.access).toBe('existing_grant');
      expect(result.data.answerBody).toBe('Full answer text');
      expect(result.meta.quota.used).toBe(1);
      expect(mockPrisma.questionAnswerAccessGrant.create).not.toHaveBeenCalled();
      expect(mockPrisma.questionBankUsageLedger.create).not.toHaveBeenCalled();
    });

    it('fails closed when an idempotency key points at an incomplete prior reservation', async () => {
      mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
        id: 'q_456',
        status: QuestionPublicationStatus.PUBLISHED,
        answers: [
          {
            id: 'ans_456',
            questionId: 'q_456',
            version: 1,
            authority: 'REFERENCE',
            answerBody: 'Full answer text',
            isPublished: true,
            createdAt: new Date(),
          },
        ],
      });
      mockPrisma.questionAnswerAccessGrant.findUnique.mockResolvedValue(null);
      mockReservations.reserveInTransaction.mockResolvedValue({
        id: 'reservation_old',
        accessPeriodKey: 'month_2026-08',
        state: 'RESERVED',
        isNewReservation: false,
      });

      await expect(service.revealAnswer('q_456', 'user_1', 'idem-replayed')).rejects.toThrow(
        /already been processed or is awaiting reconciliation/,
      );
      expect(mockPrisma.questionAnswerAccessGrant.create).not.toHaveBeenCalled();
      expect(mockPrisma.questionBankUsageLedger.create).not.toHaveBeenCalled();
    });
  });

  describe('bookmarks', () => {
    it('adds bookmark idempotently', async () => {
      mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
        id: 'q_123',
        status: QuestionPublicationStatus.PUBLISHED,
      });

      const res = await service.addBookmark('q_123', 'user_1');
      expect(res.success).toBe(true);
      expect(mockPrisma.questionBookmark.upsert).toHaveBeenCalled();
    });

    it('removes bookmark', async () => {
      const res = await service.removeBookmark('q_123', 'user_1');
      expect(res.success).toBe(true);
      expect(mockPrisma.questionBookmark.deleteMany).toHaveBeenCalled();
    });
  });

  describe('feedback', () => {
    it('records user feedback with PENDING status', async () => {
      mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
        id: 'q_123',
      });
      mockPrisma.questionFeedback.create.mockResolvedValue({
        id: 'fb_1',
      });

      const res = await service.submitFeedback('q_123', 'user_1', {
        reason: QuestionFeedbackReason.TYPO_ERROR,
        details: 'Typo on line 3',
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.questionFeedback.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('reconciliation', () => {
    it('reports healthy when all grants match usage ledger', async () => {
      mockPrisma.questionAnswerAccessGrant.findMany.mockResolvedValue([
        { id: 'g_1', userId: 'u_1' },
        { id: 'g_2', userId: 'u_2' },
      ]);
      mockPrisma.questionBankUsageLedger.findMany.mockResolvedValue([
        { id: 'u_1', grantId: 'g_1', userId: 'u_1' },
        { id: 'u_2', grantId: 'g_2', userId: 'u_2' },
      ]);

      const report = await service.adminReconciliation();
      expect(report.isHealthy).toBe(true);
      expect(report.orphanedGrants.length).toBe(0);
      expect(report.orphanedUsageRecords.length).toBe(0);
    });
  });
});
