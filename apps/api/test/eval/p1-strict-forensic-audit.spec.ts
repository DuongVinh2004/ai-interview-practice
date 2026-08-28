import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpStatus,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bullmq';
import { TutorService } from '../../src/modules/tutor/tutor.service';
import { InterviewService } from '../../src/modules/interview/interview.service';
import { HistoryReportService } from '../../src/modules/history-report/history-report.service';
import { AiOrchestratorService } from '../../src/modules/ai-orchestrator/ai-orchestrator.service';
import { ProviderRouterService } from '../../src/modules/ai-orchestrator/router/provider-router.service';
import { PromptRegistryService } from '../../src/modules/ai-orchestrator/prompt-registry/prompt-registry.service';
import { PromptRendererService } from '../../src/modules/ai-orchestrator/prompt-engine/prompt-renderer.service';
import { AiSecurityFilterService } from '../../src/modules/ai-orchestrator/security/ai-security-filter.service';
import { UsageMeterService } from '../../src/modules/billing/usage-meter.service';
import { MockAiProvider } from '../../src/modules/ai-orchestrator/providers/mock-ai.provider';
import { TenantRoleGuard, TENANT_ROLES_KEY } from '../../src/modules/b2b/guards/tenant-role.guard';
import { PrismaService } from '../../src/modules/platform/prisma/prisma.service';
import { SseService } from '../../src/modules/platform/sse/sse.service';
import { InterviewConfigurationService } from '../../src/modules/interview-configuration/interview-configuration.service';
import { DomainException } from '../../src/modules/platform/filters/all-exceptions.filter';
import {
  ErrorCode,
  UserRole,
  SessionState,
  TutorRole,
  TenantRole,
  AiRunStatus,
  QueueName,
} from '@ai-interview/contracts';

describe('Strict Forensic Verification: P1 Remediation Audit', () => {
  let tutorService: TutorService;
  let interviewService: InterviewService;
  let historyReportService: HistoryReportService;
  let aiOrchestratorService: AiOrchestratorService;
  let tenantRoleGuard: TenantRoleGuard;
  let mockAiProvider: MockAiProvider;

  let prisma: any;
  let providerRouter: any;
  let reflector: any;

  beforeEach(async () => {
    prisma = {
      interviewSession: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      tutorSession: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tutorMessage: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      questionRetry: {
        upsert: jest.fn(),
      },
      tenantMember: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      aiRun: {
        create: jest.fn().mockResolvedValue({ id: 'airun-1' }),
      },
      promptVersion: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback: any) => {
        if (typeof callback === 'function') return callback(prisma);
        return callback;
      }),
    };

    providerRouter = {
      getPriorityChain: jest.fn().mockReturnValue(['mock', 'gemini', 'openai']),
      streamSocraticChat: jest.fn(),
      evaluateAnswer: jest.fn(),
      executeWithFallback: jest.fn(),
    };

    mockAiProvider = new MockAiProvider();

    reflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TutorService,
        InterviewService,
        HistoryReportService,
        AiOrchestratorService,
        TenantRoleGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: ProviderRouterService, useValue: providerRouter },
        { provide: Reflector, useValue: reflector },
        {
          provide: SseService,
          useValue: { getSessionEventStream: jest.fn(), emitSessionEvent: jest.fn() },
        },
        {
          provide: InterviewConfigurationService,
          useValue: {
            buildConfigurationSnapshot: jest.fn().mockResolvedValue({}),
            recordRecentConfiguration: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: getQueueToken(QueueName.QUESTION_GENERATION), useValue: { add: jest.fn() } },
        { provide: getQueueToken(QueueName.ANSWER_EVALUATION), useValue: { add: jest.fn() } },
        {
          provide: UsageMeterService,
          useValue: { trackUsage: jest.fn(), checkAndConsumeQuotaInTransaction: jest.fn() },
        },
        {
          provide: PromptRegistryService,
          useValue: {
            getActivePrompt: jest
              .fn()
              .mockResolvedValue({ id: 'p-1', systemPrompt: 'System', userPrompt: 'User' }),
          },
        },
        {
          provide: PromptRendererService,
          useValue: {
            render: jest.fn().mockReturnValue('Rendered Prompt'),
            renderEvaluationPrompt: jest.fn().mockReturnValue('Rendered Evaluation Prompt'),
            renderQuestionPrompt: jest.fn().mockReturnValue('Rendered Question Prompt'),
          },
        },
        {
          provide: AiSecurityFilterService,
          useValue: {
            preFilter: jest.fn().mockReturnValue({ isSafe: true }),
            postFilter: jest.fn().mockImplementation((ctx, res) => res),
          },
        },
      ],
    }).compile();

    tutorService = module.get<TutorService>(TutorService);
    interviewService = module.get<InterviewService>(InterviewService);
    historyReportService = module.get<HistoryReportService>(HistoryReportService);
    aiOrchestratorService = module.get<AiOrchestratorService>(AiOrchestratorService);
    tenantRoleGuard = module.get<TenantRoleGuard>(TenantRoleGuard);

    jest.clearAllMocks();
  });

  // =========================================================================
  // SECTION 1: Socratic AI Live Streaming & AI Rubric Retry (NEW-FUNC-05, NEW-FUNC-01)
  // =========================================================================
  describe('P1.1: Socratic AI Live Streaming (NEW-FUNC-05)', () => {
    it('MUST stream response tokens from AI Orchestrator over SSE and persist audit AI run', async () => {
      prisma.tutorSession.findUnique.mockResolvedValue({
        id: 'tutor-1',
        userId: 'user-1',
        interviewId: 'interview-1',
        turnNumber: 1,
        turnCount: 2,
        messages: [{ role: 'USER', content: 'What is event loop?' }],
      });

      prisma.interviewSession.findUnique.mockResolvedValue({
        id: 'interview-1',
        jobRole: { name: 'Node.js Architect' },
        seniorityLevel: { name: 'Staff' },
        turns: [
          {
            turnNumber: 1,
            question: { content: 'Explain Node.js event loop phases' },
            answer: {
              content: 'It has microtask and macrotask queues.',
              evaluation: {
                score: 6.5,
                strengths: ['Mentioned microtasks'],
                improvements: ['Detail timers phase'],
              },
            },
          },
        ],
      });

      providerRouter.streamSocraticChat.mockImplementation(
        async (ctx: any, prompt: string, onToken: (t: string) => void) => {
          onToken('Think ');
          onToken('about ');
          onToken('libuv ');
          onToken('phases.');
          return {
            data: {
              fullText: 'Think about libuv phases.',
              references: [{ title: 'Node.js Docs', url: 'https://nodejs.org' }],
            },
            provider: 'mock',
            model: 'mock-socratic-v1',
            promptTokens: 40,
            completionTokens: 25,
            totalTokens: 65,
            latencyMs: 150,
            costEstimate: 0,
          };
        },
      );

      const writtenChunks: string[] = [];
      const mockRes: any = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn().mockImplementation((chunk: string) => writtenChunks.push(chunk)),
        end: jest.fn(),
      };

      await tutorService.sendChatMessageStream(
        'user-1',
        'tutor-1',
        { message: 'Can you explain the timers phase?' },
        mockRes,
      );

      // Verify SSE stream was established with headers
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');

      // Verify token chunks were written
      expect(writtenChunks.some(c => c.includes('data: {"type":"token","content":"Think "}'))).toBe(
        true,
      );
      expect(writtenChunks.some(c => c.includes('data: {"type":"token","content":"libuv "}'))).toBe(
        true,
      );
      expect(writtenChunks.some(c => c.includes('data: {"type":"done"'))).toBe(true);
      expect(mockRes.end).toHaveBeenCalled();

      // Verify AI message persisted in database with references
      expect(prisma.tutorMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId: 'tutor-1',
            role: TutorRole.AI_TUTOR,
            content: 'Think about libuv phases.',
          }),
        }),
      );

      // Verify turn count incremented
      expect(prisma.tutorSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tutor-1' },
          data: { turnCount: { increment: 1 } },
        }),
      );

      // Verify AI Run audit logging occurred
      expect(prisma.aiRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId: 'interview-1',
            provider: 'mock',
            status: AiRunStatus.SUCCESS,
            totalTokens: 65,
          }),
        }),
      );
    });

    it('MUST throw ForbiddenException if candidate does not own tutor session', async () => {
      prisma.tutorSession.findUnique.mockResolvedValue({
        id: 'tutor-1',
        userId: 'owner-user',
        turnCount: 0,
      });

      const mockRes: any = { setHeader: jest.fn(), write: jest.fn(), end: jest.fn() };

      await expect(
        tutorService.sendChatMessageStream('attacker-user', 'tutor-1', { message: 'hi' }, mockRes),
      ).rejects.toThrow(ForbiddenException);
    });

    it('MUST throw BadRequestException if tutor session reaches 20 turn limit', async () => {
      prisma.tutorSession.findUnique.mockResolvedValue({
        id: 'tutor-1',
        userId: 'user-1',
        turnCount: 20,
      });

      const mockRes: any = { setHeader: jest.fn(), write: jest.fn(), end: jest.fn() };

      await expect(
        tutorService.sendChatMessageStream(
          'user-1',
          'tutor-1',
          { message: 'overflow message' },
          mockRes,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('P1.2: Authentic AI Rubric Retry Scoring (NEW-FUNC-01)', () => {
    it('MUST evaluate retry answer using genuine AI evaluation rubric instead of string length bonus', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({
        id: 'interview-100',
        userId: 'user-1',
        jobRole: { name: 'Distributed Systems Engineer' },
        seniorityLevel: { name: 'Senior' },
        turns: [
          {
            turnNumber: 2,
            question: {
              content: 'Explain Raft consensus leader election',
              expectedPoints: [
                'Heartbeat timeouts',
                'RequestVote RPC',
                'Split votes and randomized timer',
              ],
            },
            answer: {
              content: 'Leader sends heartbeats.',
              evaluation: { score: 4.5 },
            },
          },
        ],
      });

      providerRouter.evaluateAnswer.mockResolvedValue({
        data: {
          score: 8.8,
          rubricScores: {
            technicalAccuracy: 9.0,
            depth: 8.5,
            clarity: 9.0,
          },
          strengths: [
            'Correctly explained randomized election timers',
            'Detailed RequestVote quorum',
          ],
          improvements: ['Mention term numbers for log matching'],
          conciseFeedback: 'Comprehensive explanation of Raft leader election mechanics.',
          evidence: ['Detailed RequestVote quorum'],
          confidence: 0.95,
          missingConcepts: [],
          needsReview: false,
        },
        provider: 'mock',
        model: 'mock-eval-v1',
      });

      prisma.questionRetry.upsert.mockResolvedValue({
        id: 'retry-rec-1',
        userId: 'user-1',
        interviewId: 'interview-100',
        turnNumber: 2,
        originalAnswer: 'Leader sends heartbeats.',
        retryAnswer: 'Raft uses randomized election timeouts (150-300ms) to prevent split votes...',
        originalScore: 4.5,
        retryScore: 8.8,
        improvement: 4.3,
        createdAt: new Date(),
      });

      const result = await tutorService.submitRetry('user-1', {
        interviewId: 'interview-100',
        turnNumber: 2,
        retryAnswer: 'Raft uses randomized election timeouts (150-300ms) to prevent split votes...',
      });

      expect(result.retryId).toBe('retry-rec-1');
      expect(result.originalScore).toBe(4.5);
      expect(result.retryScore).toBe(8.8);
      expect(result.improvement).toBe(4.3);
      expect(result.feedback.keyStrengths).toContain(
        'Correctly explained randomized election timers',
      );
      expect(result.feedback.modelComparison).toContain(
        'Original Score: 4.5/10 -> Retry Score: 8.8/10 (+4.3 pts)',
      );
    });

    it('MUST reject retry submission if original question turn has not been evaluated', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({
        id: 'interview-100',
        userId: 'user-1',
        turns: [
          {
            turnNumber: 1,
            question: { content: 'Some question' },
            answer: null, // Not answered/evaluated
          },
        ],
      });

      await expect(
        tutorService.submitRetry('user-1', {
          interviewId: 'interview-100',
          turnNumber: 1,
          retryAnswer: 'My retry answer',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // SECTION 2: Admin MFA BOLA Enforcement Matrix (NEW-SEC-07)
  // =========================================================================
  describe('P1.3: Admin MFA BOLA Enforcement Matrix (NEW-SEC-07)', () => {
    it('assertSessionAccess: CANDIDATE owner -> ALLOWED', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: 'user-owner' });
      await expect(
        interviewService.assertSessionAccess('user-owner', UserRole.CANDIDATE, 'sess-1', false),
      ).resolves.not.toThrow();
    });

    it('assertSessionAccess: CANDIDATE non-owner -> DENIED (403)', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: 'user-owner' });
      await expect(
        interviewService.assertSessionAccess('user-attacker', UserRole.CANDIDATE, 'sess-1', false),
      ).rejects.toThrow(DomainException);
    });

    it('assertSessionAccess: ADMIN non-owner with mfaVerified=true -> ALLOWED', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: 'user-owner' });
      await expect(
        interviewService.assertSessionAccess('admin-user', UserRole.ADMIN, 'sess-1', true),
      ).resolves.not.toThrow();
    });

    it('assertSessionAccess: ADMIN non-owner with mfaVerified=false -> DENIED (403 BOLA Blocked)', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: 'user-owner' });
      await expect(
        interviewService.assertSessionAccess('admin-user', UserRole.ADMIN, 'sess-1', false),
      ).rejects.toThrow(DomainException);
    });

    it('getSession: ADMIN non-owner with mfaVerified=false -> DENIED (403 BOLA Blocked)', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: 'user-owner',
        jobRole: { name: 'Backend' },
        seniorityLevel: { name: 'Senior' },
        technologies: [],
        turns: [],
        learningPath: null,
      });

      await expect(
        interviewService.getSession('admin-user', UserRole.ADMIN, 'sess-1', false),
      ).rejects.toThrow(DomainException);
    });

    it('getSessionStatus: ADMIN non-owner with mfaVerified=false -> DENIED (403 BOLA Blocked)', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: 'user-owner',
        turns: [],
      });

      await expect(
        interviewService.getSessionStatus('admin-user', UserRole.ADMIN, 'sess-1', false),
      ).rejects.toThrow(DomainException);
    });

    it('HistoryReport.getSessionResult: ADMIN non-owner with mfaVerified=false -> DENIED (403 BOLA Blocked)', async () => {
      prisma.interviewSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: 'user-owner',
        turns: [],
      });

      await expect(
        historyReportService.getSessionResult('admin-user', UserRole.ADMIN, 'sess-1', false),
      ).rejects.toThrow(DomainException);
    });
  });

  // =========================================================================
  // SECTION 3: B2B Single-Tenant Auto-Resolution & Fail-Closed Policy (NEW-AUTH-02)
  // =========================================================================
  describe('P1.4: B2B Single-Tenant Auto-Resolution & Fail-Closed (NEW-AUTH-02)', () => {
    it('SUPERADMIN bypasses tenant guard unconditionally', async () => {
      reflector.getAllAndOverride.mockReturnValue([TenantRole.INSTRUCTOR]);
      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { sub: 'admin-1', role: UserRole.ADMIN },
            headers: {},
            params: {},
          }),
        }),
      };

      const result = await tenantRoleGuard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('Explicit x-tenant-id + authorized role -> ALLOWED', async () => {
      reflector.getAllAndOverride.mockReturnValue([TenantRole.INSTRUCTOR]);
      const mockReq: any = {
        user: { sub: 'user-1', role: UserRole.CANDIDATE },
        headers: { 'x-tenant-id': 'tenant-alpha' },
        params: {},
      };
      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({ getRequest: () => mockReq }),
      };

      prisma.tenantMember.findUnique.mockResolvedValue({
        tenantId: 'tenant-alpha',
        userId: 'user-1',
        role: TenantRole.INSTRUCTOR,
      });

      const result = await tenantRoleGuard.canActivate(mockContext);
      expect(result).toBe(true);
      expect(mockReq.tenantRole).toBe(TenantRole.INSTRUCTOR);
    });

    it('No header + user in EXACTLY 1 tenant -> AUTO-RESOLVED and ALLOWED', async () => {
      reflector.getAllAndOverride.mockReturnValue([TenantRole.STUDENT, TenantRole.INSTRUCTOR]);
      const mockReq: any = {
        user: { sub: 'user-single', role: UserRole.CANDIDATE },
        headers: {},
        params: {},
      };
      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({ getRequest: () => mockReq }),
      };

      prisma.tenantMember.count.mockResolvedValue(1);
      prisma.tenantMember.findFirst.mockResolvedValue({
        tenantId: 'tenant-single-org',
        userId: 'user-single',
        role: TenantRole.STUDENT,
      });
      prisma.tenantMember.findUnique.mockResolvedValue({
        tenantId: 'tenant-single-org',
        userId: 'user-single',
        role: TenantRole.STUDENT,
      });

      const result = await tenantRoleGuard.canActivate(mockContext);
      expect(result).toBe(true);
      expect(mockReq.tenantId).toBe('tenant-single-org');
      expect(mockReq.tenantRole).toBe(TenantRole.STUDENT);
    });

    it('No header + user in MULTIPLE tenants -> FAILS CLOSED (403 Forbidden)', async () => {
      reflector.getAllAndOverride.mockReturnValue([TenantRole.STUDENT]);
      const mockReq: any = {
        user: { sub: 'user-multi', role: UserRole.CANDIDATE },
        headers: {},
        params: {},
      };
      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({ getRequest: () => mockReq }),
      };

      prisma.tenantMember.count.mockResolvedValue(3); // Belongs to 3 tenants

      await expect(tenantRoleGuard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });

    it('No header + user in 0 tenants -> FAILS CLOSED (403 Forbidden)', async () => {
      reflector.getAllAndOverride.mockReturnValue([TenantRole.STUDENT]);
      const mockReq: any = {
        user: { sub: 'user-no-tenant', role: UserRole.CANDIDATE },
        headers: {},
        params: {},
      };
      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({ getRequest: () => mockReq }),
      };

      prisma.tenantMember.count.mockResolvedValue(0);

      await expect(tenantRoleGuard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // SECTION 4: Mock AI Provider Socratic Streaming Interface
  // =========================================================================
  describe('P1.5: Mock AI Provider Socratic Streaming Interface', () => {
    it('MUST stream tokens to callback and return complete references array', async () => {
      const tokens: string[] = [];
      const result = await mockAiProvider.streamSocraticChat(
        {
          role: 'Backend Engineer',
          level: 'Senior',
          question: 'How to design cache?',
          originalAnswer: 'Use Redis',
          score: 5.0,
          strengths: [],
          improvements: [],
          userMessage: 'How to avoid cache stampede?',
          chatHistory: [],
        },
        'System Prompt',
        token => tokens.push(token),
      );

      expect(tokens.length).toBeGreaterThan(0);
      expect(result.data.fullText).toContain('Cache Stampede');
      expect((result.data.references || []).length).toBeGreaterThanOrEqual(2);
      expect(result.provider).toBe('mock');
      expect(result.totalTokens).toBeGreaterThan(0);
    });
  });
});
