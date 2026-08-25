import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { ProviderRouterService } from '../ai-orchestrator/router/provider-router.service';
import { SemanticCacheService } from '../ai-orchestrator/cache/semantic-cache.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { ErrorCode, AuditAction } from '@ai-interview/contracts';

describe('AdminService', () => {
  let service: AdminService;

  const mockPrismaService = {
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
      create: jest.fn(),
    },
    aiRun: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    promptVersion: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(promises => Promise.all(promises)),
  };

  const mockProviderRouterService = {
    getCircuitBreakerStates: jest.fn().mockReturnValue({
      'gemini:evaluateAnswer': { state: 'CLOSED', failureCount: 0 },
    }),
    getPriorityChain: jest.fn().mockReturnValue(['gemini', 'openai', 'anthropic', 'mock']),
    getDailyBudgetUsd: jest.fn().mockReturnValue(50.0),
    getCurrentDailyCostUsd: jest.fn().mockReturnValue(1.25),
  };

  const mockSemanticCacheService = {
    invalidateAll: jest.fn().mockResolvedValue(5),
    getMetrics: jest.fn().mockResolvedValue({
      isEnabled: true,
      totalEntries: 5,
      cacheHitsTotal: 10,
      cacheMissesTotal: 2,
      hitRatePercent: 83.33,
      estimatedSavingsUsd: 0.02,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ProviderRouterService,
          useValue: mockProviderRouterService,
        },
        {
          provide: SemanticCacheService,
          useValue: mockSemanticCacheService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('prevents an admin from locking their own account', async () => {
    const adminId = 'admin-uuid-123';
    const targetUserId = 'admin-uuid-123';

    await expect(service.lockUser(adminId, targetUserId, 'test reason')).rejects.toThrow(
      DomainException,
    );

    try {
      await service.lockUser(adminId, targetUserId, 'test reason');
    } catch (error: any) {
      expect(error.code).toBe(ErrorCode.SELF_LOCK_FORBIDDEN);
      expect(error.status).toBe(400);
    }
  });

  it('lists AI runs with pagination', async () => {
    mockPrismaService.aiRun.count.mockResolvedValue(1);
    mockPrismaService.aiRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        sessionId: 'session-1',
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        promptTokens: 200,
        completionTokens: 80,
        totalTokens: 280,
        latencyMs: 320,
        costEstimate: 0.0001,
        status: 'SUCCESS',
        metadata: null,
        createdAt: new Date(),
        promptVersion: { slug: 'answer_evaluator', version: 1 },
      },
    ]);

    const result = await service.listAiRuns({ page: 1, limit: 10 });
    expect(result.items.length).toBe(1);
    expect(result.items[0].provider).toBe('gemini');
    expect(result.meta.total).toBe(1);
  });

  it('calculates aggregated AI metrics and circuit states', async () => {
    mockPrismaService.aiRun.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(1);
    mockPrismaService.aiRun.findMany.mockResolvedValueOnce([
      {
        provider: 'gemini',
        promptTokens: 200,
        completionTokens: 80,
        totalTokens: 280,
        costEstimate: 0.0005,
        latencyMs: 350,
      },
    ]);

    const metrics = await service.getAiMetrics();
    expect(metrics.totalRuns).toBe(10);
    expect(metrics.successRuns).toBe(9);
    expect(metrics.failedRuns).toBe(1);
    expect(metrics.todayRunsCount).toBe(1);
    expect(metrics.dailyBudgetUsd).toBe(50.0);
    expect(metrics.circuitBreakerStates).toBeDefined();
  });

  it('activates a prompt version atomically', async () => {
    mockPrismaService.promptVersion.findUnique.mockResolvedValue({
      id: 'version-1',
      slug: 'answer_evaluator',
      version: 2,
    });

    const result = await service.activatePromptVersion('admin-1', 'version-1');
    expect(result.id).toBe('version-1');
    expect(result.isActive).toBe(true);
    expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: AuditAction.PROMPT_VERSION_ACTIVATED,
        }),
      }),
    );
  });
});
