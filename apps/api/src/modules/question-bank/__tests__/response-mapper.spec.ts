import { QuestionBankService } from '../services/question-bank.service';
import { QuestionPublicationStatus } from '@ai-interview/contracts';

describe('QuestionBank Response Projection & Safe Preview', () => {
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
      },
      questionBookmark: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      questionAnswerAccessGrant: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(cb => (typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb))),
    };
    mockEntitlement = {
      getEffectiveEntitlement: jest.fn().mockResolvedValue({
        accessPeriodKey: 'month_2026-08',
      }),
    };
    mockReservations = {
      getPolicyInTransaction: jest.fn().mockResolvedValue({
        accessPeriodKey: 'month_2026-08',
      }),
    };
    service = new QuestionBankService(mockPrisma, mockEntitlement, mockReservations as any);
  });

  it('listQuestions never exposes answerBody or rubric', async () => {
    mockPrisma.questionBankQuestion.count.mockResolvedValue(1);
    mockPrisma.questionBankQuestion.findMany.mockResolvedValue([
      {
        id: 'q_1',
        slug: 'system-design-cache',
        title: 'Design distributed cache',
        questionBody: 'Explain consistent hashing...',
        questionType: 'system_design',
        difficulty: 4,
        language: 'vi',
        status: QuestionPublicationStatus.PUBLISHED,
        createdById: 'author_1',
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
        technologies: [],
        answers: [{ id: 'ans_1', version: 1 }],
      },
    ]);

    const result = await service.listQuestions({ page: 1, limit: 10 });

    expect(result.items.length).toBe(1);
    const item = result.items[0] as any;
    expect(item.answerBody).toBeUndefined();
    expect(item.rubric).toBeUndefined();
    expect(item.answer).toBeUndefined();
    expect(item.previewAvailable).toBe(true);
  });

  it('getQuestionBySlug does not expose answer when user has no active grant', async () => {
    mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
      id: 'q_1',
      slug: 'system-design-cache',
      title: 'Design distributed cache',
      questionBody: 'Explain consistent hashing...',
      questionType: 'system_design',
      difficulty: 4,
      language: 'vi',
      status: QuestionPublicationStatus.PUBLISHED,
      createdById: 'author_1',
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
      technologies: [],
      answers: [
        {
          id: 'ans_1',
          questionId: 'q_1',
          version: 1,
          authority: 'FRAMEWORK',
          answerBody: 'SUPER SECRET PREMIUM ANSWER',
          rubric: { mustInclude: ['Consistent Hashing'] },
          isPublished: true,
          createdAt: new Date(),
        },
      ],
    });
    mockPrisma.questionBankQuestion.findMany.mockResolvedValue([]);
    mockPrisma.questionBookmark.findUnique.mockResolvedValue(null);
    mockPrisma.questionAnswerAccessGrant.findUnique.mockResolvedValue(null); // No grant!

    const detail = await service.getQuestionBySlug('system-design-cache', 'unauthorized_user');

    expect(detail.answer).toBeNull();
    expect(detail.isRevealed).toBe(false);
    expect(detail.previewAvailable).toBe(true);
    expect(JSON.stringify(detail)).not.toContain('SUPER SECRET PREMIUM ANSWER');
    expect(mockReservations.getPolicyInTransaction).toHaveBeenCalledWith(
      mockPrisma,
      'unauthorized_user',
      'question_bank.answer_reveals',
    );
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
  });

  it('getQuestionBySlug returns full answer when user has an active grant', async () => {
    mockPrisma.questionBankQuestion.findUnique.mockResolvedValue({
      id: 'q_1',
      slug: 'system-design-cache',
      title: 'Design distributed cache',
      questionBody: 'Explain consistent hashing...',
      questionType: 'system_design',
      difficulty: 4,
      language: 'vi',
      status: QuestionPublicationStatus.PUBLISHED,
      createdById: 'author_1',
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
      technologies: [],
      answers: [
        {
          id: 'ans_1',
          questionId: 'q_1',
          version: 1,
          authority: 'FRAMEWORK',
          answerBody: 'EXPOSED VERIFIED ANSWER',
          rubric: { mustInclude: ['Consistent Hashing'] },
          isPublished: true,
          createdAt: new Date(),
        },
      ],
    });
    mockPrisma.questionBankQuestion.findMany.mockResolvedValue([]);
    mockPrisma.questionBookmark.findUnique.mockResolvedValue(null);
    mockPrisma.questionAnswerAccessGrant.findUnique.mockResolvedValue({
      id: 'grant_1',
      grantedAt: new Date('2026-08-20T00:00:00Z'),
    });

    const detail = await service.getQuestionBySlug('system-design-cache', 'granted_user');

    expect(detail.answer).not.toBeNull();
    expect(detail.answer?.answerBody).toBe('EXPOSED VERIFIED ANSWER');
    expect(detail.isRevealed).toBe(true);
  });
});
