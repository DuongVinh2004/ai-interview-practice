import { JobName, SessionState } from '@ai-interview/contracts';
import { EvaluationProcessor } from './evaluation.processor';

describe('EvaluationProcessor completion score', () => {
  it('emits the persisted session average instead of the final-turn score', async () => {
    const evaluations = [5, 5, 5, 5, 10].map(score => ({ score }));
    const prisma: any = {
      interviewSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: 'user-1',
          state: SessionState.ACTIVE,
          totalTurns: 5,
          sessionMode: 'STANDARD',
          jobRole: { name: 'Backend Engineer' },
          seniorityLevel: { name: 'Senior' },
          turns: [
            {
              id: 'turn-5',
              status: 'ANSWERED',
              difficulty: 3,
              question: { content: 'Question', keyFocus: 'Focus', expectedPoints: [] },
              answer: { id: 'answer-5', content: 'Answer' },
            },
          ],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      interviewTurn: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
      },
      evaluation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'evaluation-5' }),
        update: jest.fn().mockResolvedValue({ id: 'evaluation-5', score: 10 }),
        findMany: jest.fn().mockResolvedValue(evaluations),
      },
      evaluationRun: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'run-5' }),
      },
      starEvaluation: { upsert: jest.fn() },
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
    };
    const sseService = { emitSessionEvent: jest.fn() } as any;
    const aiOrchestrator = {
      evaluateAnswer: jest.fn().mockResolvedValue({
        score: 10,
        rubricScores: { technicalAccuracy: 10, depth: 10, clarity: 10 },
        strengths: ['Strong'],
        improvements: [],
        conciseFeedback: 'Excellent final answer',
        evidence: ['Answer'],
        needsReview: false,
        confidence: 0.99,
        provider: 'gemini',
        model: 'gemini-test',
        promptVersionId: 'd57ac2e4-19bd-4dc7-8478-a23a4f8d4aad',
        rubricVersion: 'answer-evaluator-v1',
      }),
    } as any;
    const questionQueue = { add: jest.fn() } as any;
    const learningPathQueue = { add: jest.fn().mockResolvedValue({}) } as any;
    const eventEmitter = { emit: jest.fn() } as any;
    const processor = new EvaluationProcessor(
      prisma,
      sseService,
      aiOrchestrator,
      questionQueue,
      learningPathQueue,
      undefined,
      undefined,
      eventEmitter,
    );

    await processor.process({
      name: JobName.EVALUATE_ANSWER,
      id: 'job-5',
      data: {
        sessionId: 'session-1',
        turnId: 'turn-5',
        turnNumber: 5,
        answerId: 'answer-5',
      },
    } as any);

    expect(prisma.interviewSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ overallScore: 6 }) }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'interview.completed',
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
        overallScore: 6,
        sessionMode: 'STANDARD',
      }),
    );
    expect(learningPathQueue.add).toHaveBeenCalledWith(
      JobName.GENERATE_LEARNING_PATH,
      expect.objectContaining({ sessionId: 'session-1' }),
      expect.objectContaining({ jobId: 'lp-session-1' }),
    );

    prisma.interviewSession.updateMany.mockResolvedValue({ count: 0 });
    eventEmitter.emit.mockClear();
    learningPathQueue.add.mockClear();
    sseService.emitSessionEvent.mockClear();

    await processor.process({
      name: JobName.EVALUATE_ANSWER,
      id: 'job-5-race',
      data: {
        sessionId: 'session-1',
        turnId: 'turn-5',
        turnNumber: 5,
        answerId: 'answer-5',
      },
    } as any);

    expect(learningPathQueue.add).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('interview.completed', expect.anything());
    expect(sseService.emitSessionEvent).not.toHaveBeenCalledWith(
      'session-1',
      expect.anything(),
      expect.objectContaining({ state: SessionState.COMPLETED }),
    );

    const recoverySession = await prisma.interviewSession.findUnique({});
    recoverySession.state = SessionState.COMPLETED;
    recoverySession.overallScore = 6;
    recoverySession.turns[0].status = 'EVALUATED';
    recoverySession.learningPath = null;
    learningPathQueue.add.mockClear();

    await processor.process({
      name: JobName.EVALUATE_ANSWER,
      id: 'job-5-learning-path-recovery',
      data: {
        sessionId: 'session-1',
        turnId: 'turn-5',
        turnNumber: 5,
        answerId: 'answer-5',
      },
    } as any);

    expect(learningPathQueue.add).toHaveBeenCalledWith(
      JobName.GENERATE_LEARNING_PATH,
      expect.objectContaining({ sessionId: 'session-1' }),
      expect.objectContaining({ jobId: 'lp-session-1' }),
    );
  });
});
