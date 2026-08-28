import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AdminService } from '../../src/modules/admin/admin.service';
import { InterviewService } from '../../src/modules/interview/interview.service';
import { PrismaService } from '../../src/modules/platform/prisma/prisma.service';
import { SseService } from '../../src/modules/platform/sse/sse.service';
import { ProviderRouterService } from '../../src/modules/ai-orchestrator/router/provider-router.service';
import { SemanticCacheService } from '../../src/modules/ai-orchestrator/cache/semantic-cache.service';
import { AiOrchestratorService } from '../../src/modules/ai-orchestrator/ai-orchestrator.service';
import { DomainException } from '../../src/modules/platform/filters/all-exceptions.filter';
import { ErrorCode, UserRole, UserStatus, AuditAction } from '@ai-interview/contracts';

describe('Epic 3 Forensic Quality & Security Audit', () => {
  let adminService: AdminService;
  let interviewService: InterviewService;
  let prisma: any;
  let providerRouter: any;
  let aiOrchestrator: any;
  let sseService: any;
  let semanticCache: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      interviewSession: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      evaluation: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      aiRun: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      promptVersion: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async actions => actions),
    };

    providerRouter = {
      getCircuitBreakerStates: jest.fn().mockReturnValue({
        'gemini:evaluateAnswer': { state: 'CLOSED', failureCount: 0 },
        'openai:evaluateAnswer': { state: 'CLOSED', failureCount: 0 },
      }),
      getPriorityChain: jest.fn().mockReturnValue(['gemini', 'openai', 'anthropic', 'mock']),
      getDailyBudgetUsd: jest.fn().mockReturnValue(50.0),
      getCurrentDailyCostUsd: jest.fn().mockReturnValue(1.25),
    };

    semanticCache = {
      getMetrics: jest.fn().mockResolvedValue({
        isEnabled: true,
        totalEntries: 0,
        cacheHitsTotal: 0,
        cacheMissesTotal: 0,
        hitRatePercent: 0,
        estimatedSavingsUsd: 0,
      }),
      invalidateAll: jest.fn().mockResolvedValue(0),
    };

    aiOrchestrator = {
      evaluateAnswer: jest.fn(),
    };

    sseService = {
      emitSessionEvent: jest.fn(),
      getSessionEventStream: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: InterviewService,
          useFactory: () =>
            new InterviewService(
              prisma,
              sseService,
              aiOrchestrator,
              { checkAndConsumeQuotaInTransaction: jest.fn() } as any,
              {
                buildConfigurationSnapshot: jest.fn().mockResolvedValue({}),
                recordRecentConfiguration: jest.fn().mockResolvedValue(undefined),
              } as any,
              { add: jest.fn() } as any,
              { add: jest.fn() } as any,
            ),
        },
        { provide: PrismaService, useValue: prisma },
        { provide: ProviderRouterService, useValue: providerRouter },
        { provide: SemanticCacheService, useValue: semanticCache },
        { provide: AiOrchestratorService, useValue: aiOrchestrator },
        { provide: SseService, useValue: sseService },
      ],
    }).compile();

    adminService = module.get<AdminService>(AdminService);
    interviewService = module.get<InterviewService>(InterviewService);
  });

  describe('1. Security & RBAC Integrity', () => {
    it('STRICT: prevents admin from locking their own account', async () => {
      const adminId = 'admin-uuid-999';
      await expect(adminService.lockUser(adminId, adminId, 'Self lock test')).rejects.toThrow(
        DomainException,
      );

      try {
        await adminService.lockUser(adminId, adminId, 'Self lock test');
      } catch (err: any) {
        expect(err.code).toBe(ErrorCode.SELF_LOCK_FORBIDDEN);
        expect(err.status).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('STRICT: revokes all active refresh tokens when an account is locked', async () => {
      const adminId = 'admin-uuid-1';
      const targetUserId = 'candidate-uuid-42';

      prisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        email: 'badactor@example.com',
        status: UserStatus.ACTIVE,
      });

      prisma.user.update.mockResolvedValue({
        id: targetUserId,
        email: 'badactor@example.com',
        status: UserStatus.LOCKED,
        lockedAt: new Date(),
        lockReason: 'Suspicious bot activity',
      });

      await adminService.lockUser(adminId, targetUserId, 'Suspicious bot activity');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: targetUserId, isRevoked: false },
        data: { isRevoked: true },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: adminId,
          action: AuditAction.USER_LOCKED,
          resource: 'user',
          resourceId: targetUserId,
        }),
      });
    });

    it('STRICT: prevents candidate from accessing or re-evaluating another candidate session', async () => {
      const attackingUserId = 'candidate-attacker-id';
      const sessionOwnerId = 'candidate-victim-id';
      const sessionId = 'session-victim-123';

      prisma.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: sessionOwnerId,
        turns: [],
      });

      await expect(
        interviewService.reEvaluateTurn(attackingUserId, UserRole.CANDIDATE, sessionId, 1),
      ).rejects.toThrow(DomainException);

      try {
        await interviewService.reEvaluateTurn(attackingUserId, UserRole.CANDIDATE, sessionId, 1);
      } catch (err: any) {
        expect(err.code).toBe(ErrorCode.FORBIDDEN);
        expect(err.status).toBe(HttpStatus.FORBIDDEN);
      }
    });
  });

  describe('2. Turn Re-Evaluation Mathematical Consistency', () => {
    it('STRICT: throws RESOURCE_NOT_FOUND if turn has no answer or was not evaluated', async () => {
      const userId = 'candidate-1';
      const sessionId = 'session-100';

      prisma.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId,
        jobRole: { name: 'Frontend Engineer' },
        seniorityLevel: { name: 'Senior' },
        turns: [
          {
            turnNumber: 2,
            question: { content: 'Explain React reconciliation' },
            answer: null, // Not answered yet
          },
        ],
      });

      await expect(
        interviewService.reEvaluateTurn(userId, UserRole.CANDIDATE, sessionId, 2),
      ).rejects.toThrow(DomainException);
    });

    it('STRICT: accurately updates score and recalculates session overall average', async () => {
      const userId = 'candidate-1';
      const sessionId = 'session-100';

      prisma.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId,
        jobRole: { name: 'Backend Engineer' },
        seniorityLevel: { name: 'Senior' },
        turns: [
          {
            turnNumber: 1,
            question: { content: 'Explain DB indexing', keyFocus: 'B-Trees', expectedPoints: [] },
            answer: {
              id: 'ans-1',
              content: 'B-Trees allow O(log n) lookups by maintaining sorted key pages.',
              evaluation: { id: 'eval-1', score: 6.0 },
            },
          },
        ],
      });

      aiOrchestrator.evaluateAnswer.mockResolvedValue({
        score: 9.2,
        rubricScores: { technicalAccuracy: 9.5, depth: 9.0, clarity: 9.0 },
        strengths: ['Accurate B-Tree explanation'],
        improvements: ['None'],
        conciseFeedback: 'High technical depth',
        evidence: ['B-Trees allow O(log n) lookups'],
        confidence: 0.98,
        missingConcepts: [],
        needsReview: false,
      });

      prisma.evaluation.update.mockResolvedValue({
        id: 'eval-1',
        answerId: 'ans-1',
        score: 9.2,
        rubricScores: { technicalAccuracy: 9.5, depth: 9.0, clarity: 9.0 },
        conciseFeedback: 'High technical depth',
      });

      // Existing evaluations in session: turn 1 (9.2), turn 2 (8.0) -> Average = 8.6
      prisma.evaluation.findMany.mockResolvedValue([{ score: 9.2 }, { score: 8.0 }]);

      const result = await interviewService.reEvaluateTurn(
        userId,
        UserRole.ADMIN,
        sessionId,
        1,
        { reason: 'Added B-Tree complexity details' },
        true,
      );

      expect(result.score).toBe(9.2);
      expect(result.overallScore).toBe(8.6);
      expect(prisma.interviewSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { overallScore: 8.6 },
      });
      expect(sseService.emitSessionEvent).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          action: AuditAction.EVALUATION_RE_EVALUATED,
        }),
      });
    });
  });

  describe('3. Atomic Prompt Version Activation', () => {
    it('STRICT: uses transaction to deactivate older versions and activate target atomically', async () => {
      const adminId = 'admin-1';
      const versionId = 'v-new-123';

      prisma.promptVersion.findUnique.mockResolvedValue({
        id: versionId,
        slug: 'answer_evaluator',
        version: 2,
        isActive: false,
      });

      const result = await adminService.activatePromptVersion(adminId, versionId);

      expect(result.isActive).toBe(true);
      expect(result.slug).toBe('answer_evaluator');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.promptVersion.updateMany).toHaveBeenCalledWith({
        where: { slug: 'answer_evaluator', isActive: true },
        data: { isActive: false },
      });
      expect(prisma.promptVersion.update).toHaveBeenCalledWith({
        where: { id: versionId },
        data: { isActive: true },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: adminId,
          action: AuditAction.PROMPT_VERSION_ACTIVATED,
        }),
      });
    });
  });

  describe('4. AI Telemetry Aggregation Edge Cases', () => {
    it('STRICT: gracefully handles empty database runs without NaN or division by zero', async () => {
      prisma.aiRun.count.mockResolvedValue(0);
      prisma.aiRun.findMany.mockResolvedValue([]);

      const metrics = await adminService.getAiMetrics();

      expect(metrics.totalRuns).toBe(0);
      expect(metrics.successRuns).toBe(0);
      expect(metrics.failedRuns).toBe(0);
      expect(metrics.successRate).toBe(100);
      expect(metrics.todayCostUsd).toBe(0);
      expect(metrics.todayTokens).toBe(0);
      expect(metrics.avgLatencyMs).toBe(0);
      expect(metrics.budgetUsedPercentage).toBe(0);
      expect(Number.isNaN(metrics.budgetUsedPercentage)).toBe(false);
      expect(Number.isNaN(metrics.avgLatencyMs)).toBe(false);
    });
  });
});
