import { Test, TestingModule } from '@nestjs/testing';
import { InterviewService } from '../interview.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SseService } from '../../platform/sse/sse.service';
import { MetricsService } from '../../platform/metrics/metrics.service';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ErrorCode, SessionState } from '@ai-interview/contracts';
import { AiOrchestratorService } from '../../ai-orchestrator/ai-orchestrator.service';
import { UsageMeterService } from '../../billing/usage-meter.service';
import { InterviewConfigurationService } from '../../interview-configuration/interview-configuration.service';

describe('Interview Submission State Machine & CAS (P1-009)', () => {
  let interviewService: InterviewService;

  const mockPrisma: any = {
    interviewSession: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    answer: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    interviewTurn: {
      update: jest.fn(),
    },
    $transaction: jest.fn(cb => (typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb))),
  };

  const mockEvaluationQueue = {
    add: jest.fn(),
  };
  const mockQuestionQueue = {
    add: jest.fn(),
  };
  const mockLearningPathQueue = {
    add: jest.fn(),
  };

  const mockSseService = {
    emitSessionEvent: jest.fn(),
  };

  const mockMetricsService = {
    sessionStateTransitionsTotal: { inc: jest.fn() },
    sessionTurnDurationSeconds: { observe: jest.fn() },
    evaluationTurnLatencySeconds: { observe: jest.fn() },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(5),
  };

  const mockAiOrchestrator = {
    generateQuestion: jest.fn(),
    evaluateAnswer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SseService, useValue: mockSseService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: AiOrchestratorService, useValue: mockAiOrchestrator },
        {
          provide: UsageMeterService,
          useValue: { checkAndConsumeQuotaInTransaction: jest.fn() },
        },
        {
          provide: InterviewConfigurationService,
          useValue: {
            buildConfigurationSnapshot: jest.fn().mockResolvedValue({}),
            recordRecentConfiguration: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: 'BullQueue_question-generation', useValue: mockQuestionQueue },
        { provide: 'BullQueue_answer-evaluation', useValue: mockEvaluationQueue },
      ],
    }).compile();

    interviewService = module.get<InterviewService>(InterviewService);
    jest.clearAllMocks();
  });

  const userId = 'user-123';
  const sessionId = 'session-123';
  const turnId = 'turn-123';

  it('rejects answer submission with Conflict error when concurrent modification changes ACTIVE state', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValue({
      id: sessionId,
      userId,
      state: SessionState.ACTIVE,
      currentTurn: 1,
      turns: [
        {
          id: turnId,
          turnNumber: 1,
          question: { content: 'What is ACID?' },
          answer: null,
        },
      ],
    });

    mockPrisma.answer.create.mockResolvedValue({ id: 'ans-1', submittedAt: new Date() });
    mockPrisma.interviewTurn.update.mockResolvedValue({});

    // Simulate concurrent modification where state was already changed away from ACTIVE
    mockPrisma.interviewSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      interviewService.submitAnswer(userId, sessionId, {
        turnId,
        answerText: 'Atomicity, Consistency, Isolation, Durability',
      }),
    ).rejects.toThrow(DomainException);

    try {
      await interviewService.submitAnswer(userId, sessionId, {
        turnId,
        answerText: 'Atomicity, Consistency, Isolation, Durability',
      });
    } catch (err: any) {
      expect(err.code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
    }
  });

  it('does NOT transition session to FAILED when BullMQ enqueue temporarily fails', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValue({
      id: sessionId,
      userId,
      state: SessionState.ACTIVE,
      currentTurn: 1,
      turns: [
        {
          id: turnId,
          turnNumber: 1,
          question: { content: 'What is ACID?' },
          answer: null,
        },
      ],
    });

    mockPrisma.answer.create.mockResolvedValue({ id: 'ans-1', submittedAt: new Date() });
    mockPrisma.interviewTurn.update.mockResolvedValue({});
    mockPrisma.interviewSession.updateMany.mockResolvedValue({ count: 1 });

    // BullMQ throws error on add
    mockEvaluationQueue.add.mockRejectedValue(new Error('Redis connection error'));

    await expect(
      interviewService.submitAnswer(userId, sessionId, {
        turnId,
        answerText: 'Atomicity, Consistency, Isolation, Durability',
      }),
    ).rejects.toThrow(DomainException);

    // Ensure full rollback: answer deleted, turn reverted to AWAITING_ANSWER, session reverted to ACTIVE (REL-001)
    expect(mockPrisma.answer.delete).toHaveBeenCalledWith({
      where: { id: 'ans-1' },
    });
    expect(mockPrisma.interviewTurn.update).toHaveBeenCalledWith({
      where: { id: turnId },
      data: { status: 'AWAITING_ANSWER' },
    });
    expect(mockPrisma.interviewSession.updateMany).toHaveBeenCalledWith({
      where: { id: sessionId, state: SessionState.EVALUATING },
      data: { state: SessionState.ACTIVE },
    });
  });
});
