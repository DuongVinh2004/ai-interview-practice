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
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      questionBankAnswer: {
        update: jest.fn(),
        create: jest.fn(),
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
      answers: [{ id: 'ans_1', version: 1, reviewedById: 'reviewer_2', reviewedAt: new Date() }],
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
    mockPrisma.questionBankQuestion.findUnique
      .mockResolvedValueOnce({
        id: 'q_1',
        status: QuestionPublicationStatus.APPROVED,
        answers: [{ id: 'ans_1', version: 1, reviewedById: 'reviewer_2', reviewedAt: new Date() }],
      })
      .mockResolvedValueOnce({ id: 'q_1', status: QuestionPublicationStatus.PUBLISHED });
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

  it('rejects publication when an edit changes the approved state before the CAS transition', async () => {
    mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
      id: 'q_race',
      status: QuestionPublicationStatus.APPROVED,
      answers: [
        { id: 'ans_reviewed', version: 2, reviewedById: 'reviewer_2', reviewedAt: new Date() },
      ],
    });
    mockPrisma.questionBankQuestion.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.adminPublish('q_race', 'publisher_1')).rejects.toMatchObject({
      code: ErrorCode.CONTENT_NOT_REVIEWED,
    });
  });

  it('resets a published edit to DRAFT and keeps the published answer until review', async () => {
    const oldAnswer = {
      id: 'ans_1',
      version: 1,
      answerBody: 'published answer',
      authority: 'REFERENCE',
      isPublished: true,
    };
    mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
      id: 'q_1',
      status: QuestionPublicationStatus.PUBLISHED,
      currentAnswerId: oldAnswer.id,
      answers: [oldAnswer],
    });
    mockPrisma.questionBankQuestion.update.mockResolvedValue({
      id: 'q_1',
      status: QuestionPublicationStatus.DRAFT,
      currentAnswerId: oldAnswer.id,
    });
    mockPrisma.questionBankAnswer.create.mockResolvedValue({
      id: 'ans_2',
      version: 2,
      isPublished: false,
    });

    const updated = await service.adminUpdateQuestion(
      'q_1',
      { answerBody: 'new answer' },
      'editor_1',
    );

    expect(updated.status).toBe(QuestionPublicationStatus.DRAFT);
    expect(mockPrisma.questionBankQuestion.update).toHaveBeenCalledWith({
      where: { id: 'q_1' },
      data: expect.objectContaining({ status: QuestionPublicationStatus.DRAFT }),
    });
    expect(mockPrisma.questionBankAnswer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        questionId: 'q_1',
        version: 2,
        answerBody: 'new answer',
        isPublished: false,
      }),
    });
    expect(mockPrisma.questionBankAnswer.update).not.toHaveBeenCalled();
  });

  it('creates questions as drafts so the author cannot bypass approval', async () => {
    mockPrisma.questionBankQuestion.findUnique.mockResolvedValue(null);
    mockPrisma.questionBankQuestion.create.mockResolvedValue({ id: 'q-new' });
    mockPrisma.questionBankAnswer.create.mockResolvedValue({ id: 'ans-new' });
    mockPrisma.questionBankQuestion.update.mockResolvedValue({
      id: 'q-new',
      status: QuestionPublicationStatus.DRAFT,
    });

    await service.adminCreateQuestion(
      {
        title: 'New question',
        questionBody: 'Question body',
        questionType: 'conceptual',
        initialAnswer: { answerBody: 'Reference answer' },
      } as any,
      'author_1',
    );

    expect(mockPrisma.questionBankQuestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: QuestionPublicationStatus.DRAFT,
        publishedAt: null,
      }),
    });
    expect(mockPrisma.questionBankAnswer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isPublished: false }),
    });
  });

  it('rejects an APPROVED question whose latest answer has no review record', async () => {
    mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
      id: 'q_1',
      status: QuestionPublicationStatus.APPROVED,
      answers: [{ id: 'ans_1', version: 2 }],
    });

    await expect(service.adminPublish('q_1', 'publisher_1')).rejects.toMatchObject({
      code: ErrorCode.CONTENT_NOT_REVIEWED,
    });
  });
});
