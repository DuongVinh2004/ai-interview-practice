import { JobName, SessionState } from '@ai-interview/contracts';
import { EvaluationProcessor } from './evaluation.processor';

describe('EvaluationProcessor authority boundary', () => {
  it('does not turn a mock or review-required score into authoritative side effects', async () => {
    const prisma: any = {
      interviewSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-review',
          userId: 'user-1',
          state: SessionState.ACTIVE,
          totalTurns: 1,
          overallScore: null,
          sessionMode: 'STANDARD',
          learningPath: null,
          user: { email: 'user@example.com', profile: { fullName: 'Candidate' } },
          jobRole: { name: 'Backend Engineer' },
          seniorityLevel: { name: 'Senior' },
          turns: [{
            id: 'turn-1',
            turnNumber: 1,
            status: 'ANSWER_SUBMITTED',
            difficulty: 1,
            question: { content: 'Question', keyFocus: 'Focus', expectedPoints: [] },
            answer: { id: 'answer-1', content: 'Untrusted answer' },
          }],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      interviewTurn: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
      evaluation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'evaluation-1' }),
        update: jest.fn().mockResolvedValue({ id: 'evaluation-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      evaluationRun: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'run-1' }),
      },
      starEvaluation: { upsert: jest.fn() },
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
    };
    const eventEmitter = { emit: jest.fn() } as any;
    const learningPathQueue = { add: jest.fn() } as any;
    const processor = new EvaluationProcessor(
      prisma,
      { emitSessionEvent: jest.fn() } as any,
      {
        evaluateAnswer: jest.fn().mockResolvedValue({
          score: 9.9,
          rubricScores: { technicalAccuracy: 10, depth: 10, clarity: 9.7 },
          strengths: ['Unverified'],
          improvements: ['Manual review required'],
          conciseFeedback: 'Mock output',
          evidence: [],
          needsReview: true,
          confidence: 0.5,
          provider: 'mock',
          model: 'mock-model-v1',
          rubricVersion: 'answer-evaluator-v1',
        }),
      } as any,
      { add: jest.fn() } as any,
      learningPathQueue,
      undefined,
      undefined,
      eventEmitter,
    );

    await processor.process({
      name: JobName.EVALUATE_ANSWER,
      id: 'job-review',
      data: {
        sessionId: 'session-review',
        turnId: 'turn-1',
        turnNumber: 1,
        answerId: 'answer-1',
      },
    } as any);

    expect(prisma.evaluationRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        authorityState: 'NEEDS_REVIEW',
        provider: 'mock',
        model: 'mock-model-v1',
        rubricVersion: 'answer-evaluator-v1',
      }),
    });
    expect(prisma.interviewSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ overallScore: null }) }),
    );
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('evaluation.completed', expect.anything());
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('interview.completed', expect.anything());
    expect(learningPathQueue.add).not.toHaveBeenCalled();
  });
});
