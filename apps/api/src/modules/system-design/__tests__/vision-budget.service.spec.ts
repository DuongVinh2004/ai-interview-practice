import { HttpStatus } from '@nestjs/common';
import { VisionBudgetService } from '../services/vision-budget.service';
import { VisionEntitlementService } from '../services/vision-entitlement.service';
import { MockVisionProvider } from '../providers/mock-vision.provider';

describe('VisionBudgetService & Vision API Cost Quota Buffer (Task 1.4)', () => {
  let budgetService: VisionBudgetService;
  let mockPrisma: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockPrisma = {
      aiRun: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'vision.dailyBudgetUsd' || key === 'VISION_DAILY_BUDGET_USD') {
          return 5.0;
        }
        return defaultValue;
      }),
    };

    budgetService = new VisionBudgetService(mockPrisma as any, mockConfigService as any);
  });

  it('reads daily budget from env / config with default 5.0 USD', () => {
    expect(budgetService.getDailyBudgetUsd()).toBe(5.0);
  });

  it('allows execution when total daily vision cost is strictly within budget', async () => {
    mockPrisma.aiRun.findMany.mockResolvedValue([
      { costEstimate: 1.5, metadata: { type: 'VISION' } },
      { costEstimate: 2.0, metadata: { type: 'VISION' } },
      { costEstimate: 10.0, metadata: { type: 'TEXT_LLM' } }, // Non-vision, should be ignored
    ]);

    const result = await budgetService.checkBudget(0.5);
    expect(result).toBe(true);
  });

  it('rejects with 429 when total daily vision cost exceeds budget', async () => {
    mockPrisma.aiRun.findMany.mockResolvedValue([
      { costEstimate: 3.5, metadata: { type: 'VISION' } },
      { costEstimate: 1.6, metadata: { type: 'VISION' } }, // total 5.1 > 5.0
    ]);

    await expect(budgetService.checkBudget(0.1)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('records a new aiRun record with type VISION and estimated cost', async () => {
    mockPrisma.aiRun.create.mockResolvedValue({
      id: 'mock-ai-run-id',
      costEstimate: 0.05,
      metadata: { type: 'VISION' },
    });

    const recorded = await budgetService.recordVisionRun({
      provider: 'openai',
      model: 'gpt-4o',
      costEstimate: 0.05,
      latencyMs: 1200,
      sessionId: 'test-session-id',
      promptTokens: 800,
      completionTokens: 200,
      totalTokens: 1000,
    });

    expect(mockPrisma.aiRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4o',
        costEstimate: 0.05,
        status: 'SUCCESS',
        metadata: expect.objectContaining({ type: 'VISION' }),
      }),
    });
    expect(recorded).toBeDefined();
  });

  describe('Integration with VisionEntitlementService', () => {
    let entitlementService: VisionEntitlementService;
    let mockReservations: any;
    let mockProvider: MockVisionProvider;

    beforeEach(() => {
      mockReservations = {
        reserve: jest.fn().mockResolvedValue({
          id: 'res-1',
          state: 'RESERVED',
          isNewReservation: true,
        }),
        markProviderDispatchStarted: jest.fn().mockResolvedValue(undefined),
        commit: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        markForReconciliation: jest.fn().mockResolvedValue(undefined),
      };

      mockProvider = new MockVisionProvider();
      entitlementService = new VisionEntitlementService(mockReservations as any, budgetService);
    });

    it('denies vision evaluation with 429 when vision budget is exhausted', async () => {
      // Set runs to exceed budget
      mockPrisma.aiRun.findMany.mockResolvedValue([
        { costEstimate: 5.5, metadata: { type: 'VISION' } },
      ]);

      await expect(
        entitlementService.evaluate({
          userId: 'test-user-id',
          idempotencyKey: 'idemp-12345',
          operationType: 'system-design.evaluate-diagram',
          interviewId: 'interview-1',
          provider: mockProvider,
          options: {
            imageBase64: 'data:image/png;base64,mock',
            imageUrl: 'data:image/png;base64,mock',
            problemTitle: 'Test System',
          },
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('allows vision evaluation and records aiRun with type VISION when within budget', async () => {
      mockPrisma.aiRun.findMany.mockResolvedValue([
        { costEstimate: 1.0, metadata: { type: 'VISION' } },
      ]);
      mockPrisma.aiRun.create.mockResolvedValue({
        id: 'new-run',
        costEstimate: 0.02,
        metadata: { type: 'VISION' },
      });

      const result = await entitlementService.evaluate({
        userId: 'test-user-id',
        idempotencyKey: 'idemp-67890',
        operationType: 'system-design.evaluate-diagram',
        interviewId: 'interview-1',
        provider: mockProvider,
        options: {
          imageBase64: 'data:image/png;base64,mock',
          imageUrl: 'data:image/png;base64,mock',
          problemTitle: 'Test System',
        },
      });

      expect(result).toBeDefined();
      expect(mockPrisma.aiRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({ type: 'VISION' }),
          }),
        }),
      );
    });
  });
});
