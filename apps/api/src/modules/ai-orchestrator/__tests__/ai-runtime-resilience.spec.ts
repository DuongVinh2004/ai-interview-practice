import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProviderRouterService } from '../router/provider-router.service';
import { GeminiProvider } from '../providers/gemini.provider';
import { OpenAiProvider } from '../providers/openai.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { MockAiProvider } from '../providers/mock-ai.provider';
import { SemanticCacheService } from '../cache/semantic-cache.service';
import { MetricsService } from '../../platform/metrics/metrics.service';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ErrorCode } from '@ai-interview/contracts';

describe('AI Runtime Resilience & Timeout/Retry Configuration (REL-002 / PRD-1201)', () => {
  let router: ProviderRouterService;
  let mockProvider: MockAiProvider;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'ai.provider') return 'router';
      if (key === 'ai.providerPriority') return 'mock';
      if (key === 'ai.timeoutMs') return 5000;
      if (key === 'ai.maxRetries') return 3;
      if (key === 'ai.dailyBudgetUsd') return 50.0;
      if (key === 'ai.maxProviderCallCostUsd') return 2.0;
      return defaultValue;
    }),
  };

  const mockSemanticCache = {
    isCacheEnabled: jest.fn().mockReturnValue(false),
    get: jest.fn().mockResolvedValue({ hit: false }),
    set: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderRouterService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: GeminiProvider, useValue: { name: 'gemini' } },
        { provide: OpenAiProvider, useValue: { name: 'openai' } },
        { provide: AnthropicProvider, useValue: { name: 'anthropic' } },
        MockAiProvider,
        { provide: SemanticCacheService, useValue: mockSemanticCache },
        MetricsService,
      ],
    }).compile();

    router = module.get<ProviderRouterService>(ProviderRouterService);
    mockProvider = module.get<MockAiProvider>(MockAiProvider);
  });

  it('configures timeout and max retries from ConfigService', () => {
    expect(router).toBeDefined();
    expect(mockConfigService.get).toHaveBeenCalledWith('ai.timeoutMs', 10000);
    expect(mockConfigService.get).toHaveBeenCalledWith('ai.maxRetries', 2);
  });

  it('retries on transient errors and succeeds when subsequent attempt passes', async () => {
    let attempts = 0;
    const mockFn = jest.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('Transient 503 network timeout');
      }
      return {
        data: { question: 'Test question?', role: 'frontend', level: 'senior' },
        model: 'mock-model',
        provider: 'mock',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 50,
      };
    });

    const result = await router.executeWithFallback('generateQuestion', mockFn);
    expect(attempts).toBe(2);
    expect(result.data).toBeDefined();
  });

  it('immediately throws non-retryable 401/403/Quota errors without wasting retries', async () => {
    let attempts = 0;
    const nonRetryableError = new DomainException(
      ErrorCode.UNAUTHORIZED,
      'Invalid API key provided',
      401,
    );

    const mockFn = jest.fn().mockImplementation(async () => {
      attempts++;
      throw nonRetryableError;
    });

    await expect(router.executeWithFallback('generateQuestion', mockFn)).rejects.toThrow(
      'Invalid API key provided',
    );
    expect(attempts).toBe(1); // Exactly 1 attempt, NO retries
  });

  it('circuit breaker tracks state and opens after consecutive failures', async () => {
    const cb = router.getCircuitBreaker();
    expect(cb.canExecute('openai', 'evaluateAnswer')).toBe(true);

    // Record consecutive failures
    for (let i = 0; i < 5; i++) {
      cb.recordFailure('openai', 'evaluateAnswer');
    }

    expect(cb.canExecute('openai', 'evaluateAnswer')).toBe(false);
  });
});
