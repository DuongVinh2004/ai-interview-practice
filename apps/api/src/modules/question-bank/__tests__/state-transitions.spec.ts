import { QuestionBankService } from '../services/question-bank.service';
import { QuestionPublicationStatus, ErrorCode } from '@ai-interview/contracts';

describe('QuestionBank State Transitions & Governance', () => {
  let service: QuestionBankService;
  let mockPrisma: any;
  let mockEntitlement: any;

  beforeEach(() => {
    mockPrisma = {
      questionBankQuestion: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      questionBankAnswer: {
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(cb => cb(mockPrisma)),
    };
    mockEntitlement = {};
    service = new QuestionBankService(mockPrisma, mockEntitlement, {} as any);
  });

  it('allows submission for review from DRAFT status', async () => {
    mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
      id: 'q_1',
      status: QuestionPublicationStatus.DRAFT,
    });
    mockPrisma.questionBankQuestion.update.mockResolvedValue({
      id: 'q_1',
      status: QuestionPublicationStatus.IN_REVIEW,
    });

    const result = await service.adminSubmitReview('q_1', 'author_1');
    expect(result.status).toBe(QuestionPublicationStatus.IN_REVIEW);
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('rejects review when reviewer is the author', async () => {
    mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
      id: 'q_1',
      status: QuestionPublicationStatus.IN_REVIEW,
      createdById: 'user_same',
      answers: [{ id: 'ans_1', version: 1 }],
    });

    await expect(
      service.adminReview('q_1', { action: 'APPROVE' }, 'user_same'),
    ).rejects.toMatchObject({
      code: ErrorCode.QUESTION_BANK_REVIEWER_EQUALS_AUTHOR,
    });
  });

  it('approves question when reviewer is a different user', async () => {
    mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
      id: 'q_1',
      status: QuestionPublicationStatus.IN_REVIEW,
      createdById: 'author_1',
      answers: [{ id: 'ans_1', version: 1 }],
    });
    mockPrisma.questionBankQuestion.update.mockResolvedValue({
      id: 'q_1',
      status: QuestionPublicationStatus.APPROVED,
    });

    const result = await service.adminReview(
      'q_1',
      { action: 'APPROVE', reviewNotes: 'LGTM' },
      'reviewer_2',
    );
    expect(result.status).toBe(QuestionPublicationStatus.APPROVED);
    expect(mockPrisma.questionBankAnswer.update).toHaveBeenCalled();
  });

  it('rejects publish if question is not in APPROVED status', async () => {
    mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
      id: 'q_1',
      status: QuestionPublicationStatus.DRAFT,
      answers: [{ id: 'ans_1', version: 1 }],
    });

    await expect(service.adminPublish('q_1', 'publisher_1')).rejects.toMatchObject({
      code: ErrorCode.CONTENT_NOT_REVIEWED,
    });
  });

  it('publishes question and marks latest answer as isPublished', async () => {
    mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
      id: 'q_1',
      status: QuestionPublicationStatus.APPROVED,
      answers: [{ id: 'ans_1', version: 1 }],
    });
    mockPrisma.questionBankQuestion.update.mockResolvedValue({
      id: 'q_1',
      status: QuestionPublicationStatus.PUBLISHED,
    });

    const result = await service.adminPublish('q_1', 'publisher_1');
    expect(result.status).toBe(QuestionPublicationStatus.PUBLISHED);
    expect(mockPrisma.questionBankAnswer.update).toHaveBeenCalledWith({
      where: { id: 'ans_1' },
      data: { isPublished: true },
    });
  });
});
