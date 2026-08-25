import { Test, TestingModule } from '@nestjs/testing';
import { ProviderRouterService } from '../router/provider-router.service';
import { ConfigService } from '@nestjs/config';
import { SemanticCacheService } from '../cache/semantic-cache.service';
import { MetricsService } from '../../platform/metrics/metrics.service';
import { MockAiProvider } from '../providers/mock-ai.provider';
import { GeminiProvider } from '../providers/gemini.provider';
import { OpenAiProvider } from '../providers/openai.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';

describe('AI Mock Authority & Production Guard (P1-007)', () => {
  let providerRouter: ProviderRouterService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultVal?: any) => {
      if (key === 'ai.provider') return 'mock';
      if (key === 'ai.dailyBudgetUsd') return 50.0;
      return defaultVal;
    }),
  };

  const mockCacheService = {
    isCacheEnabled: jest.fn().mockReturnValue(true),
    get: jest.fn().mockResolvedValue({ hit: false }),
    set: jest.fn().mockResolvedValue(undefined),
  };

  const mockMetricsService = {
    aiProviderRequestsTotal: { inc: jest.fn() },
    aiProviderLatencySeconds: { observe: jest.fn() },
    aiCostUsdTotal: { inc: jest.fn() },
    aiTokensTotal: { inc: jest.fn() },
    evaluationNeedsReviewTotal: { inc: jest.fn() },
    aiCircuitBreakerState: { set: jest.fn() },
    aiCircuitBreakerTripsTotal: { inc: jest.fn() },
  };

  const mockAiProvider = new MockAiProvider();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderRouterService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SemanticCacheService, useValue: mockCacheService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: MockAiProvider, useValue: mockAiProvider },
        { provide: GeminiProvider, useValue: mockAiProvider },
        { provide: OpenAiProvider, useValue: mockAiProvider },
        { provide: AnthropicProvider, useValue: mockAiProvider },
      ],
    }).compile();

    providerRouter = module.get<ProviderRouterService>(ProviderRouterService);
    jest.clearAllMocks();
  });

  it('marks needsReview and isMockProvider on any mock evaluation result', async () => {
    const result = await providerRouter.evaluateAnswer(
      {
        role: 'Backend Engineer',
        question: 'Explain ACID properties',
        answer: 'Atomicity, Consistency, Isolation, Durability',
        level: 'Mid-Level',
      },
      'system prompt',
    );

    expect(result.provider).toBe('mock');
    expect(result.data.needsReview).toBe(true);
    expect((result.data as any).isMockProvider).toBe(true);
  });

  it('does NOT cache mock AI responses into semantic cache', async () => {
    await providerRouter.evaluateAnswer(
      {
        role: 'Backend Engineer',
        question: 'Explain CAP theorem',
        answer: 'Consistency, Availability, Partition tolerance',
        level: 'Senior',
      },
      'system prompt',
    );

    // Cache set must not be called when provider is 'mock'
    expect(mockCacheService.set).not.toHaveBeenCalled();
  });

  it('blocks mock provider in production environment', () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.AI_ALLOW_MOCK;

      expect(() => providerRouter.getPriorityChain()).toThrow(
        'Mock AI provider cannot be primary provider in production',
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
