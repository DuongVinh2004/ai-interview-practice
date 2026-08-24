import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProviderRouterService } from '../../src/modules/ai-orchestrator/router/provider-router.service';
import { GeminiProvider } from '../../src/modules/ai-orchestrator/providers/gemini.provider';
import { OpenAiProvider } from '../../src/modules/ai-orchestrator/providers/openai.provider';
import { AnthropicProvider } from '../../src/modules/ai-orchestrator/providers/anthropic.provider';
import { MockAiProvider } from '../../src/modules/ai-orchestrator/providers/mock-ai.provider';
import { SemanticCacheService } from '../../src/modules/ai-orchestrator/cache/semantic-cache.service';
import { MetricsService } from '../../src/modules/platform/metrics/metrics.service';
import { TelemetryService } from '../../src/modules/platform/telemetry/telemetry.service';
import { EvaluationPromptContext } from '../../src/modules/ai-orchestrator/interfaces/ai-provider.interface';

describe('Game Day: AI Provider Outage & Chaos Resilience (AIP-062)', () => {
  let routerService: ProviderRouterService;
  let geminiProvider: GeminiProvider;
  let openAiProvider: OpenAiProvider;
  let anthropicProvider: AnthropicProvider;
  let mockProvider: MockAiProvider;
  let metricsService: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderRouterService,
        MetricsService,
        TelemetryService,
        {
          provide: SemanticCacheService,
          useValue: {
            isCacheEnabled: jest.fn().mockReturnValue(false),
            get: jest.fn().mockResolvedValue({ hit: false }),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'ai.provider') return 'router';
              if (key === 'ai.providerPriority') return 'gemini,openai,anthropic,mock';
              if (key === 'ai.dailyBudgetUsd') return 50.0;
              return defaultValue;
            }),
          },
        },
        {
          provide: GeminiProvider,
          useValue: {
            generateQuestion: jest.fn(),
            evaluateAnswer: jest.fn(),
            generateLearningPath: jest.fn(),
          },
        },
        {
          provide: OpenAiProvider,
          useValue: {
            generateQuestion: jest.fn(),
            evaluateAnswer: jest.fn(),
            generateLearningPath: jest.fn(),
          },
        },
        {
          provide: AnthropicProvider,
          useValue: {
            generateQuestion: jest.fn(),
            evaluateAnswer: jest.fn(),
            generateLearningPath: jest.fn(),
          },
        },
        {
          provide: MockAiProvider,
          useValue: {
            generateQuestion: jest.fn().mockResolvedValue({
              data: {
                content: 'Mock fallback question',
                type: 'SYSTEM_DESIGN',
                difficulty: 'MEDIUM',
                expectedPoints: ['Modularity', 'Scalability'],
              },
              provider: 'mock',
              model: 'deterministic-mock',
            }),
            evaluateAnswer: jest.fn().mockResolvedValue({
              data: {
                score: 7.5,
                rubricScores: { technicalAccuracy: 8, depth: 7, communication: 8 },
                strengths: ['Clear design overview'],
                improvements: ['Include cache invalidation strategy'],
                conciseFeedback: 'Good solid architectural design.',
                evidence: 'Mentioned horizontal scaling.',
                needsReview: false,
              },
              provider: 'mock',
              model: 'deterministic-mock',
            }),
            generateLearningPath: jest.fn().mockResolvedValue({
              data: {
                overallProficiency: 'MID',
                strengths: ['System design fundamentals'],
                gaps: ['Cache invalidation'],
                topics: [],
              },
              provider: 'mock',
              model: 'deterministic-mock',
            }),
          },
        },
      ],
    }).compile();

    routerService = module.get<ProviderRouterService>(ProviderRouterService);
    geminiProvider = module.get<GeminiProvider>(GeminiProvider);
    openAiProvider = module.get<OpenAiProvider>(OpenAiProvider);
    anthropicProvider = module.get<AnthropicProvider>(AnthropicProvider);
    mockProvider = module.get<MockAiProvider>(MockAiProvider);
    metricsService = module.get<MetricsService>(MetricsService);
  });

  it('Game Day Scenario 1: Triple Provider Outage -> Cascades to Mock Provider with zero data loss', async () => {
    // Simulate catastrophic outage across all 3 external cloud providers
    (geminiProvider.evaluateAnswer as jest.Mock).mockRejectedValue(new Error('Google Gemini API 503 Overloaded'));
    (openAiProvider.evaluateAnswer as jest.Mock).mockRejectedValue(new Error('OpenAI API 500 Internal Server Error'));
    (anthropicProvider.evaluateAnswer as jest.Mock).mockRejectedValue(new Error('Anthropic Claude 429 Rate Limit Exceeded'));

    const evalContext: EvaluationPromptContext = {
      role: 'Backend Engineer',
      level: 'Senior',
      question: 'How do you handle cache-aside pattern with Redis in NestJS?',
      answer: 'I use a Redis cache wrapper with TTL and distributed locks to prevent stampedes.',
    };

    const result = await routerService.evaluateAnswer(evalContext, 'System Prompt', 'User Prompt');

    expect(result).toBeDefined();
    expect(result.provider).toBe('mock');
    expect(result.data.score).toBe(7.5);
    // When falling back to mock after external provider failure, needsReview MUST be flagged true
    expect(result.data.needsReview).toBe(true);
    expect(geminiProvider.evaluateAnswer).toHaveBeenCalled();
    expect(openAiProvider.evaluateAnswer).toHaveBeenCalled();
    expect(anthropicProvider.evaluateAnswer).toHaveBeenCalled();
    expect(mockProvider.evaluateAnswer).toHaveBeenCalled();
  });

  it('Game Day Scenario 2: Circuit Breaker transitions to OPEN upon consecutive provider failures', async () => {
    (geminiProvider.generateQuestion as jest.Mock).mockRejectedValue(new Error('Gemini 500 Outage'));

    const circuitBreaker = routerService.getCircuitBreaker();
    expect(circuitBreaker.canExecute('gemini', 'generateQuestion')).toBe(true);

    // Trip circuit breaker with 5 consecutive failures
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute('gemini', 'generateQuestion', async () => {
          throw new Error('Gemini 500 Outage');
        });
      } catch {
        // Expected
      }
    }

    // Now circuit breaker should be OPEN
    expect(circuitBreaker.canExecute('gemini', 'generateQuestion')).toBe(false);
    const state = circuitBreaker.getState('gemini', 'generateQuestion');
    expect(state).toBe('OPEN');
  });

  it('Game Day Scenario 3: Daily Budget exhaustion safely triggers zero-cost fallback', async () => {
    // Mock daily spend exceeding $50 budget limit
    const evalContext: EvaluationPromptContext = {
      role: 'Backend Engineer',
      level: 'Mid',
      question: 'Explain PostgreSQL MVCC',
      answer: 'PostgreSQL uses multi-version concurrency control with xmin and xmax transaction IDs.',
    };

    // Inject $55 cost
    (routerService as any).currentDailyCostUsd = 55.0;

    const result = await routerService.evaluateAnswer(evalContext, 'System Prompt');
    expect(result.provider).toBe('mock');
    // Paid providers should have been skipped due to budget cap
    expect(geminiProvider.evaluateAnswer).not.toHaveBeenCalled();
    expect(openAiProvider.evaluateAnswer).not.toHaveBeenCalled();
  });
});
