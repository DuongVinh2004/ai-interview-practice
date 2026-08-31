import { Job } from 'bullmq';
import { JobName } from '@ai-interview/contracts';
import { LearningPathProcessor } from './learning-path.processor';

describe('LearningPathProcessor authority boundary', () => {
  const prisma = {
    interviewSession: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  } as any;
  const sseService = { emitSessionEvent: jest.fn() } as any;
  const aiOrchestrator = { generateLearningPath: jest.fn() } as any;
  let processor: LearningPathProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new LearningPathProcessor(prisma, sseService, aiOrchestrator);
  });

  it('blocks review-only evidence before invoking the paid learning-path provider', async () => {
    prisma.interviewSession.findUnique.mockResolvedValue({
      id: 'session-review-only',
      overallScore: 9.9,
      jobRole: { name: 'Backend Engineer' },
      seniorityLevel: { name: 'Senior' },
      turns: [
        {
          turnNumber: 1,
          question: { content: 'Question' },
          answer: {
            content: 'Answer',
            evaluation: {
              score: 9.9,
              authorityState: 'NEEDS_REVIEW',
              needsReview: true,
              provider: 'mock',
              evidence: [],
            },
          },
        },
      ],
    });

    const result = await processor.process({
      id: 'job-review-only',
      name: JobName.GENERATE_LEARNING_PATH,
      data: { sessionId: 'session-review-only' },
    } as Job<any, any, string>);

    expect(result).toBeUndefined();
    expect(aiOrchestrator.generateLearningPath).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(sseService.emitSessionEvent).not.toHaveBeenCalled();
  });

  it('generates from authoritative evidence only and recomputes the trusted score', async () => {
    prisma.interviewSession.findUnique.mockResolvedValue({
      id: 'session-mixed',
      overallScore: 9.9,
      jobRole: { name: 'Backend Engineer' },
      seniorityLevel: { name: 'Senior' },
      turns: [
        {
          turnNumber: 1,
          question: { content: 'Trusted question' },
          answer: {
            content: 'Trusted answer',
            evaluation: {
              score: 8,
              strengths: ['Clear'],
              improvements: ['More detail'],
              authorityState: 'AUTHORITATIVE',
              needsReview: false,
              provider: 'openai',
              evidence: ['Quoted answer evidence'],
            },
          },
        },
        {
          turnNumber: 2,
          question: { content: 'Mock question' },
          answer: {
            content: 'Mock answer',
            evaluation: {
              score: 10,
              strengths: ['Synthetic'],
              improvements: [],
              authorityState: 'NEEDS_REVIEW',
              needsReview: true,
              provider: 'mock',
              evidence: [],
            },
          },
        },
      ],
    });
    aiOrchestrator.generateLearningPath.mockResolvedValue({
      summary: 'Trusted plan',
      items: [
        {
          gap: 'Depth',
          topic: 'Distributed systems',
          priority: 'HIGH',
          recommendedAction: 'Practice',
          searchKeywords: ['distributed systems'],
        },
      ],
    });
    const learningPath = { id: 'learning-path-1' };
    const tx = {
      learningPath: { upsert: jest.fn().mockResolvedValue(learningPath) },
      learningPathItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );

    await processor.process({
      id: 'job-mixed',
      name: JobName.GENERATE_LEARNING_PATH,
      data: { sessionId: 'session-mixed' },
    } as Job<any, any, string>);

    expect(aiOrchestrator.generateLearningPath).toHaveBeenCalledWith(
      'session-mixed',
      expect.objectContaining({
        overallScore: 8,
        turns: [expect.objectContaining({ turnNumber: 1, score: 8 })],
      }),
    );
    expect(tx.learningPathItem.createMany).toHaveBeenCalled();
    expect(sseService.emitSessionEvent).toHaveBeenCalled();
  });
});
