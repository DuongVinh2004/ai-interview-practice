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

describe('Tier 5: Multi-Provider Fallback & Latency Bounds (AI-FAILOVER-001..008)', () => {
  let routerService: ProviderRouterService;
  let mockGemini: jest.Mocked<GeminiProvider>;
  let mockOpenAi: jest.Mocked<OpenAiProvider>;
  let mockAnthropic: jest.Mocked<AnthropicProvider>;
  let mockProvider: MockAiProvider;

  const mockEvalContext: EvaluationPromptContext = {
    role: 'Backend Engineer',
    level: 'Senior',
    question: 'How do you handle database failover in PostgreSQL?',
    answer: 'We use Patroni with etcd for automated leader election and replication failover.',
  };

  beforeEach(async () => {
    mockGemini = {
      name: 'gemini',
      generateQuestion: jest.fn(),
      evaluateAnswer: jest.fn(),
      generateLearningPath: jest.fn(),
    } as any;

    mockOpenAi = {
      name: 'openai',
      generateQuestion: jest.fn(),
      evaluateAnswer: jest.fn(),
      generateLearningPath: jest.fn(),
    } as any;

    mockAnthropic = {
      name: 'anthropic',
      generateQuestion: jest.fn(),
      evaluateAnswer: jest.fn(),
      generateLearningPath: jest.fn(),
    } as any;

    mockProvider = new MockAiProvider();

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
            get: jest.fn((key: string, def?: any) => {
              if (key === 'ai.provider') return 'router';
              if (key === 'ai.providerPriority') return 'gemini,openai,anthropic,mock';
              if (key === 'ai.dailyBudgetUsd') return 50.0;
              if (key === 'ai.timeoutMs') return 5000;
              return def;
            }),
          },
        },
        { provide: GeminiProvider, useValue: mockGemini },
        { provide: OpenAiProvider, useValue: mockOpenAi },
        { provide: AnthropicProvider, useValue: mockAnthropic },
        { provide: MockAiProvider, useValue: mockProvider },
      ],
    }).compile();

    routerService = module.get<ProviderRouterService>(ProviderRouterService);
  });

  it('PFL-01. Gemini 429 Rate Limit cascades to OpenAI in <= 1500ms', async () => {
    const rateLimitError: any = new Error('Google Gemini API 429 Resource Exhausted');
    rateLimitError.status = 429;

    mockGemini.evaluateAnswer.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 10));
      throw rateLimitError;
    });

    mockOpenAi.evaluateAnswer.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 20));
      return {
        data: {
          score: 8.5,
          rubricScores: { technicalAccuracy: 8.5, depth: 8.0, clarity: 9.0 },
          strengths: ['Clear explanation of Patroni and etcd'],
          improvements: [],
          conciseFeedback: 'Solid understanding of automated PostgreSQL failover.',
          evidence: ['Patroni with etcd'],
          confidence: 0.95,
          missingConcepts: [],
          needsReview: false,
        },
        model: 'gpt-4o',
        provider: 'openai',
        latencyMs: 100,
        costEstimate: 0.002,
      };
    });

    const start = Date.now();
    const result = await routerService.evaluateAnswer(mockEvalContext, 'System');
    const elapsed = Date.now() - start;

    expect(result.provider).toBe('openai');
    expect(result.data.score).toBe(8.5);
    expect(elapsed).toBeLessThanOrEqual(1500);
  });

  it('PFL-02. Gemini 429 -> OpenAI 500 -> Anthropic success cascades in <= 1500ms', async () => {
    const geminiErr: any = new Error('Gemini 429 Rate Limit');
    geminiErr.status = 429;
    const openAiErr: any = new Error('OpenAI 400 Bad Request');
    openAiErr.status = 400;

    mockGemini.evaluateAnswer.mockRejectedValue(geminiErr);
    mockOpenAi.evaluateAnswer.mockRejectedValue(openAiErr);

    mockAnthropic.evaluateAnswer.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 80));
      return {
        data: {
          score: 8.0,
          rubricScores: { technicalAccuracy: 8.0, depth: 8.0, clarity: 8.0 },
          strengths: ['Great high availability design'],
          improvements: [],
          conciseFeedback: 'Good failover design.',
          evidence: ['etcd for automated leader election'],
          confidence: 0.9,
          missingConcepts: [],
          needsReview: false,
        },
        model: 'claude-3-5-sonnet',
        provider: 'anthropic',
        latencyMs: 80,
      };
    });

    const start = Date.now();
    const result = await routerService.evaluateAnswer(mockEvalContext, 'System');
    const elapsed = Date.now() - start;

    expect(result.provider).toBe('anthropic');
    expect(elapsed).toBeLessThanOrEqual(1500);
  });

  it('PFL-03. All external providers down cascades to deterministic Mock with needsReview=true', async () => {
    mockGemini.evaluateAnswer.mockRejectedValue(new Error('Gemini 503'));
    mockOpenAi.evaluateAnswer.mockRejectedValue(new Error('OpenAI 503'));
    mockAnthropic.evaluateAnswer.mockRejectedValue(new Error('Anthropic 503'));

    const result = await routerService.evaluateAnswer(mockEvalContext, 'System');

    expect(result.provider).toBe('mock');
    expect(result.data.needsReview).toBe(true);
    expect(result.data.score).toBeGreaterThan(0);
  });

  it('PFL-04. Daily budget exhaustion switches immediately to zero-cost fallback in <= 100ms', async () => {
    (routerService as any).currentDailyCostUsd = 55.0; // Over $50 limit

    const start = Date.now();
    const result = await routerService.evaluateAnswer(mockEvalContext, 'System');
    const elapsed = Date.now() - start;

    expect(result.provider).toBe('mock');
    expect(mockGemini.evaluateAnswer).not.toHaveBeenCalled();
    expect(mockOpenAi.evaluateAnswer).not.toHaveBeenCalled();
    expect(elapsed).toBeLessThanOrEqual(100);
  });

  it('PFL-05. Circuit Breaker fast-fails without hitting broken provider', async () => {
    const circuitBreaker = routerService.getCircuitBreaker();

    // Trip Gemini CB with failures
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute('gemini', 'evaluateAnswer', async () => {
          throw new Error('Gemini 500 Outage');
        });
      } catch {
        // Expected
      }
    }

    expect(circuitBreaker.canExecute('gemini', 'evaluateAnswer')).toBe(false);

    mockOpenAi.evaluateAnswer.mockResolvedValueOnce({
      data: {
        score: 7.5,
        rubricScores: { technicalAccuracy: 7.5, depth: 7.5, clarity: 7.5 },
        strengths: [],
        improvements: [],
        conciseFeedback: 'OK',
        evidence: [],
        confidence: 0.85,
        missingConcepts: [],
        needsReview: false,
      },
      model: 'gpt-4o',
      provider: 'openai',
      latencyMs: 50,
    });

    const result = await routerService.evaluateAnswer(mockEvalContext, 'System');

    expect(result.provider).toBe('openai');
    // Gemini was not invoked because circuit was OPEN
    expect(mockGemini.evaluateAnswer).not.toHaveBeenCalled();
  });
});
