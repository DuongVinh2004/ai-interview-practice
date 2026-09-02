import { JobName } from '@ai-interview/contracts';
import { InterviewQueueReconciliationCron } from './interview-queue-reconciliation.cron';

describe('InterviewQueueReconciliationCron', () => {
  it('recreates deterministic jobs from durable turn state', async () => {
    const prisma: any = {
      interviewTurn: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'turn-answer',
              turnNumber: 1,
              answer: { id: 'answer-1' },
              session: { id: 'session-1' },
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'turn-question',
              turnNumber: 2,
              difficulty: 3,
              session: { id: 'session-1', currentTurn: 2 },
            },
          ]),
      },
    };
    const evaluationQueue = { add: jest.fn().mockResolvedValue({}) } as any;
    const questionQueue = { add: jest.fn().mockResolvedValue({}) } as any;
    const cron = new InterviewQueueReconciliationCron(prisma, evaluationQueue, questionQueue);

    await cron.reconcile();

    expect(evaluationQueue.add).toHaveBeenCalledWith(
      JobName.EVALUATE_ANSWER,
      expect.objectContaining({ answerId: 'answer-1' }),
      expect.objectContaining({ jobId: 'eval-session-1-turn-1' }),
    );
    expect(questionQueue.add).toHaveBeenCalledWith(
      JobName.GENERATE_QUESTION,
      expect.objectContaining({ turnId: 'turn-question' }),
      expect.objectContaining({ jobId: 'question-session-1-turn-2' }),
    );
  });
});
