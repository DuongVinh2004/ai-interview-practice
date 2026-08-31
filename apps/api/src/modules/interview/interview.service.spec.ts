import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { InterviewService } from './interview.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { SseService } from '../platform/sse/sse.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { QueueName, UserRole } from '@ai-interview/contracts';
import { AiOrchestratorService } from '../ai-orchestrator/ai-orchestrator.service';
import { UsageMeterService } from '../billing/usage-meter.service';
import { InterviewConfigurationService } from '../interview-configuration/interview-configuration.service';

describe('InterviewService (Unit)', () => {
  let service: InterviewService;
  let prisma: any;
  let sseService: any;
  let questionQueue: any;
  let evaluationQueue: any;
  let usageMeter: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
      interviewSession: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      jobRole: { findUnique: jest.fn() },
      seniorityLevel: { findUnique: jest.fn() },
      technology: { findMany: jest.fn() },
      evaluation: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    sseService = {
      emitSessionEvent: jest.fn(),
      getSessionEventStream: jest.fn(),
    };

    questionQueue = { add: jest.fn() };
    evaluationQueue = { add: jest.fn() };
    usageMeter = { checkAndConsumeQuotaInTransaction: jest.fn().mockResolvedValue({}) };

    const mockAiOrchestrator = {
      evaluateAnswer: jest.fn().mockResolvedValue({
        score: 9.0,
        rubricScores: { technicalAccuracy: 9.0, depth: 9.0, clarity: 9.0 },
        strengths: ['Clear explanation'],
        improvements: ['Minor details'],
        conciseFeedback: 'Excellent answer',
        evidence: ['Clear explanation'],
        confidence: 0.95,
        missingConcepts: [],
        needsReview: false,
      }),
    };

    const mockConfigService = {
      buildConfigurationSnapshot: jest.fn().mockResolvedValue({}),
      recordRecentConfiguration: jest.fn().mockResolvedValue(undefined),
      validateConfiguration: jest.fn().mockResolvedValue({ isValid: true, issues: [] }),
      computeFingerprint: jest.fn().mockReturnValue('mock-fingerprint'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewService,
        { provide: PrismaService, useValue: prisma },
        { provide: SseService, useValue: sseService },
        { provide: AiOrchestratorService, useValue: mockAiOrchestrator },
        { provide: UsageMeterService, useValue: usageMeter },
        { provide: InterviewConfigurationService, useValue: mockConfigService },
        { provide: getQueueToken(QueueName.QUESTION_GENERATION), useValue: questionQueue },
        { provide: getQueueToken(QueueName.ANSWER_EVALUATION), useValue: evaluationQueue },
      ],
    }).compile();

    service = module.get<InterviewService>(InterviewService);
  });

  describe('assertSessionAccess (BOLA / IDOR Prevention)', () => {
    it('should allow access if the user owns the session', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({
        id: 'session-123',
        userId: 'owner-user-id',
      });

      await expect(
        service.assertSessionAccess('owner-user-id', UserRole.CANDIDATE, 'session-123'),
      ).resolves.not.toThrow();
    });

    it('should allow access if requester is ADMIN with verified MFA even if not owner', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({
        id: 'session-123',
        userId: 'owner-user-id',
      });

      await expect(
        service.assertSessionAccess('admin-user-id', UserRole.ADMIN, 'session-123', true),
      ).resolves.not.toThrow();
    });

    it('should deny access if requester is ADMIN but mfaVerified is false (BOLA protection)', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({
        id: 'session-123',
        userId: 'owner-user-id',
      });

      await expect(
        service.assertSessionAccess('admin-user-id', UserRole.ADMIN, 'session-123', false),
      ).rejects.toThrow(DomainException);
    });

    it('should deny access (throw FORBIDDEN) if another candidate tries to access the session', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({
        id: 'session-123',
        userId: 'owner-user-id',
      });

      await expect(
        service.assertSessionAccess('attacker-user-id', UserRole.CANDIDATE, 'session-123'),
      ).rejects.toThrow(DomainException);
    });

    it('should throw NOT_FOUND if session does not exist', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue(null);

      await expect(
        service.assertSessionAccess('any-user', UserRole.CANDIDATE, 'non-existent-session'),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('reEvaluateTurn', () => {
    it('should re-evaluate an evaluated turn and recalculate session overall score', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({
        id: 'session-123',
        userId: 'owner-1',
        jobRole: { name: 'Backend Engineer' },
        seniorityLevel: { name: 'Senior' },
        turns: [
          {
            id: 'turn-1',
            turnNumber: 1,
            question: { content: 'Explain idempotency', expectedPoints: ['idempotency key'] },
            answer: {
              id: 'ans-1',
              content: 'Use an idempotency key with database unique constraint',
              evaluation: { id: 'eval-1', score: 7.0 },
            },
          },
        ],
      });

      prisma.evaluation.update = jest.fn().mockResolvedValue({
        id: 'eval-1',
        answerId: 'ans-1',
        score: 9.0,
        rubricScores: { technicalAccuracy: 9.0, depth: 9.0, clarity: 9.0 },
        strengths: ['Great!'],
        improvements: [],
        conciseFeedback: 'Excellent',
        evidence: ['idempotency key'],
        createdAt: new Date(),
      });

      prisma.evaluation.findMany = jest.fn().mockResolvedValue([{ id: 'eval-1', score: 9.0 }]);

      prisma.auditLog = { create: jest.fn().mockResolvedValue({}) };

      const result = await service.reEvaluateTurn('owner-1', UserRole.CANDIDATE, 'session-123', 1, {
        reason: 'Updated answer nuance',
      });

      expect(result.score).toBe(9.0);
      expect(result.overallScore).toBe(9.0);
      expect(sseService.emitSessionEvent).toHaveBeenCalled();
    });

    it('never promotes NEEDS_REVIEW evaluations when no authoritative evaluation exists', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({
        id: 'session-123',
        userId: 'owner-1',
        jobRole: { name: 'Backend Engineer' },
        seniorityLevel: { name: 'Senior' },
        turns: [
          {
            id: 'turn-1',
            turnNumber: 1,
            question: { content: 'Explain idempotency', expectedPoints: ['idempotency key'] },
            answer: {
              id: 'ans-1',
              content: 'Use an idempotency key',
              evaluation: { id: 'eval-1', score: 7.0 },
            },
          },
        ],
      });
      prisma.evaluation.update.mockResolvedValue({
        id: 'eval-1',
        answerId: 'ans-1',
        score: 9.0,
        rubricScores: { technicalAccuracy: 9.0, depth: 9.0, clarity: 9.0 },
        strengths: ['Clear'],
        improvements: [],
        conciseFeedback: 'Excellent',
        evidence: [],
        createdAt: new Date(),
      });
      prisma.evaluation.findMany.mockResolvedValueOnce([]);

      const result = await service.reEvaluateTurn(
        'owner-1',
        UserRole.CANDIDATE,
        'session-123',
        1,
        {},
      );

      expect(result.overallScore).toBeNull();
      expect(prisma.evaluation.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.evaluation.findMany).toHaveBeenCalledWith({
        where: {
          answer: { turn: { sessionId: 'session-123' } },
          authorityState: 'AUTHORITATIVE',
          needsReview: false,
        },
      });
    });
  });

  describe('createSession modes (Epic 6)', () => {
    it('creates a focused remediation session with custom turns', async () => {
      prisma.jobRole.findUnique.mockResolvedValue({
        id: 'role-1',
        isActive: true,
        name: 'Backend',
      });
      prisma.seniorityLevel.findUnique.mockResolvedValue({
        id: 'lvl-1',
        isActive: true,
        name: 'Senior',
      });
      prisma.technology.findMany.mockResolvedValue([
        { id: 'tech-1', isActive: true, name: 'Node.js' },
      ]);

      prisma.interviewSession.create.mockResolvedValue({
        id: 'session-rem-1',
        userId: 'user-1',
        jobRoleId: 'role-1',
        seniorityLevelId: 'lvl-1',
        state: 'CREATED',
        sessionMode: 'FOCUSED_REMEDIATION',
        competencyArea: 'DATABASE_CONCURRENCY',
        isSandbox: false,
        currentTurn: 1,
        totalTurns: 3,
        targetDifficulty: 1,
        jobRole: {
          id: 'role-1',
          name: 'Backend',
          slug: 'backend',
          description: '',
          isActive: true,
        },
        seniorityLevel: {
          id: 'lvl-1',
          name: 'Senior',
          slug: 'senior',
          order: 1,
          description: '',
          isActive: true,
        },
        technologies: [
          { id: 'tech-1', name: 'Node.js', slug: 'nodejs', category: 'Backend', isActive: true },
        ],
        turns: [
          {
            id: 'turn-1',
            sessionId: 'session-rem-1',
            turnNumber: 1,
            difficulty: 1,
            status: 'PENDING',
            isFollowUp: false,
            parentTurnNumber: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'turn-2',
            sessionId: 'session-rem-1',
            turnNumber: 2,
            difficulty: 1,
            status: 'PENDING',
            isFollowUp: false,
            parentTurnNumber: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'turn-3',
            sessionId: 'session-rem-1',
            turnNumber: 3,
            difficulty: 1,
            status: 'PENDING',
            isFollowUp: false,
            parentTurnNumber: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        learningPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createSession('user-1', {
        jobRoleId: 'role-1',
        seniorityLevelId: 'lvl-1',
        technologyIds: ['tech-1'],
        sessionMode: 'FOCUSED_REMEDIATION' as any,
        competencyArea: 'DATABASE_CONCURRENCY' as any,
        totalTurns: 3,
      });

      expect(result.sessionMode).toBe('FOCUSED_REMEDIATION');
      expect(result.competencyArea).toBe('DATABASE_CONCURRENCY');
      expect(result.totalTurns).toBe(3);
      expect(result.turns).toHaveLength(3);
      expect(usageMeter.checkAndConsumeQuotaInTransaction).toHaveBeenCalledWith(
        prisma,
        'user-1',
        'SESSION_COUNT',
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });
});
