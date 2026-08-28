import { QuestionBankService } from '../services/question-bank.service';
import { QuestionPublicationStatus } from '@ai-interview/contracts';

describe('QuestionBank Security & IDOR Isolation', () => {
  let service: QuestionBankService;
  let mockPrisma: any;
  let mockEntitlement: any;

  beforeEach(() => {
    mockPrisma = {
      questionBookmark: {
        findMany: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
      questionAnswerAccessGrant: {
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    mockEntitlement = {
      getEffectiveEntitlement: jest.fn().mockResolvedValue({
        accessPeriodKey: 'month_2026-08',
      }),
    };

    service = new QuestionBankService(mockPrisma, mockEntitlement, {} as any);
  });

  it('listBookmarks is strictly scoped to requesting authenticated user', async () => {
    mockPrisma.questionBookmark.count.mockResolvedValue(0);
    mockPrisma.questionBookmark.findMany.mockResolvedValue([]);
    mockPrisma.questionAnswerAccessGrant.findMany.mockResolvedValue([]);

    await service.listBookmarks('user_victim_123', { page: 1, limit: 10 });

    expect(mockPrisma.questionBookmark.count).toHaveBeenCalledWith({
      where: { userId: 'user_victim_123' },
    });
    expect(mockPrisma.questionBookmark.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_victim_123' },
      }),
    );
  });

  it('removeBookmark scopes deletion by authenticated userId', async () => {
    await service.removeBookmark('q_target_1', 'user_acting');

    expect(mockPrisma.questionBookmark.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_acting',
        questionId: 'q_target_1',
      },
    });
  });
});
