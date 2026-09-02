import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProviderRouterService } from './provider-router.service';
import { GeminiProvider } from '../providers/gemini.provider';
import { OpenAiProvider } from '../providers/openai.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { MockAiProvider } from '../providers/mock-ai.provider';
import { EvaluatedAnswerAi } from '@ai-interview/contracts';
import { SemanticCacheService } from '../cache/semantic-cache.service';

describe('ProviderRouterService Spec', () => {
  let routerService: ProviderRouterService;
  let mockGemini: jest.Mocked<GeminiProvider>;
  let mockOpenAi: jest.Mocked<OpenAiProvider>;
  let mockAnthropic: jest.Mocked<AnthropicProvider>;
  let mockProvider: MockAiProvider;
  let mockSemanticCache: Partial<SemanticCacheService>;
  let configGet: jest.Mock;

  beforeEach(async () => {
    configGet = jest.fn((key: string, defaultValue: any) => {
      if (key === 'ai.provider') return 'router';
      if (key === 'ai.providerPriority') return 'gemini,openai,anthropic,mock';
      if (key === 'ai.dailyBudgetUsd') return 50.0;
      return defaultValue;
    });

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

    mockSemanticCache = {
      isCacheEnabled: jest.fn().mockReturnValue(false),
      get: jest.fn().mockResolvedValue({ hit: false }),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderRouterService,
        {
          provide: ConfigService,
          useValue: { get: configGet },
        },
        { provide: GeminiProvider, useValue: mockGemini },
        { provide: OpenAiProvider, useValue: mockOpenAi },
        { provide: AnthropicProvider, useValue: mockAnthropic },
        { provide: MockAiProvider, useValue: mockProvider },
        { provide: SemanticCacheService, useValue: mockSemanticCache },
      ],
    }).compile();

    routerService = module.get<ProviderRouterService>(ProviderRouterService);
  });

  it('resolves priority chain correctly from config', () => {
    const chain = routerService.getPriorityChain();
    expect(chain).toEqual(['gemini', 'openai', 'anthropic', 'mock']);
  });

  it('removes mock from the production router fallback chain', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAllowMock = process.env.AI_ALLOW_MOCK;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.AI_ALLOW_MOCK;

      expect(routerService.getPriorityChain()).toEqual(['gemini', 'openai', 'anthropic']);
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalAllowMock === undefined) delete process.env.AI_ALLOW_MOCK;
      else process.env.AI_ALLOW_MOCK = originalAllowMock;
    }
  });

  it('fails closed when production router priority contains no real provider', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAllowMock = process.env.AI_ALLOW_MOCK;
    configGet.mockImplementation((key: string, defaultValue: any) => {
      if (key === 'ai.provider') return 'router';
      if (key === 'ai.providerPriority') return 'mock,unknown';
      if (key === 'ai.dailyBudgetUsd') return 50.0;
      return defaultValue;
    });

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.AI_ALLOW_MOCK;

      expect(() => routerService.getPriorityChain()).toThrow(
        'No production AI provider configured',
      );
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalAllowMock === undefined) delete process.env.AI_ALLOW_MOCK;
      else process.env.AI_ALLOW_MOCK = originalAllowMock;
    }
  });

  it('routes to primary provider (Gemini) when healthy', async () => {
    const expectedData: EvaluatedAnswerAi = {
      score: 8.5,
      rubricScores: { technicalAccuracy: 8.5, depth: 8.0, clarity: 9.0 },
      strengths: ['Great technical grasp'],
      improvements: ['None'],
      conciseFeedback: 'Solid answer.',
      evidence: ['sample evidence'],
      confidence: 0.95,
      missingConcepts: [],
      needsReview: false,
    };

    mockGemini.evaluateAnswer.mockResolvedValueOnce({
      data: expectedData,
      model: 'gemini-2.0-flash',
      provider: 'gemini',
      promptTokens: 200,
      completionTokens: 100,
      totalTokens: 300,
      latencyMs: 150,
      costEstimate: 0.00006,
    });

    const result = await routerService.evaluateAnswer(
      { role: 'Backend', level: 'Senior', question: 'Q', answer: 'A' },
      'System prompt',
    );

    expect(result.provider).toBe('gemini');
    expect(mockGemini.evaluateAnswer).toHaveBeenCalledTimes(1);
    expect(mockOpenAi.evaluateAnswer).not.toHaveBeenCalled();
  });

  it('cascades from Gemini to OpenAI when Gemini fails', async () => {
    mockGemini.evaluateAnswer.mockRejectedValue(new Error('Gemini API 503 Overloaded'));

    const expectedData: EvaluatedAnswerAi = {
      score: 8.0,
      rubricScores: { technicalAccuracy: 8.0, depth: 8.0, clarity: 8.0 },
      strengths: ['Clear'],
      improvements: ['None'],
      conciseFeedback: 'Good.',
      evidence: [],
      confidence: 0.9,
      missingConcepts: [],
      needsReview: false,
    };

    mockOpenAi.evaluateAnswer.mockResolvedValueOnce({
      data: expectedData,
      model: 'gpt-4o',
      provider: 'openai',
      latencyMs: 300,
      costEstimate: 0.001,
    });

    const result = await routerService.evaluateAnswer(
      { role: 'Backend', level: 'Senior', question: 'Q', answer: 'A' },
      'System prompt',
    );

    expect(result.provider).toBe('openai');
    expect(mockOpenAi.evaluateAnswer).toHaveBeenCalledTimes(1);
  });

  it('falls back to MockAiProvider with needsReview flag when all external providers fail', async () => {
    mockGemini.evaluateAnswer.mockRejectedValue(new Error('Gemini 500'));
    mockOpenAi.evaluateAnswer.mockRejectedValue(new Error('OpenAI 500'));
    mockAnthropic.evaluateAnswer.mockRejectedValue(new Error('Anthropic 500'));

    const result = await routerService.evaluateAnswer(
      {
        role: 'Backend Engineer',
        level: 'Senior',
        question: 'Làm thế nào để thiết kế một API idempotent?',
        answer: 'Client gửi idempotency key và server xử lý trong cùng transaction.',
      },
      'System prompt',
    );

    expect(result.provider).toBe('mock');
    expect(result.data.needsReview).toBe(true);
  });

  it('immediately skips provider without retrying on 401 auth error', async () => {
    const authError: any = new Error('Invalid API Key');
    authError.status = 401;

    mockGemini.evaluateAnswer.mockRejectedValue(authError);
    mockOpenAi.evaluateAnswer.mockResolvedValueOnce({
      data: {
        score: 7.0,
        rubricScores: { technicalAccuracy: 7.0, depth: 7.0, clarity: 7.0 },
        strengths: ['OK'],
        improvements: ['OK'],
        conciseFeedback: 'OK',
        evidence: [],
        confidence: 0.85,
        missingConcepts: [],
        needsReview: false,
      },
      model: 'gpt-4o',
      provider: 'openai',
      latencyMs: 200,
    });

    const result = await routerService.evaluateAnswer(
      { role: 'Dev', level: 'Mid', question: 'Q', answer: 'A' },
      'System',
    );

    expect(mockGemini.evaluateAnswer).toHaveBeenCalledTimes(1); // No retries for 401
    expect(result.provider).toBe('openai');
  });

  it('does not use semantic cache for personalized learning paths', async () => {
    (mockSemanticCache.isCacheEnabled as jest.Mock).mockReturnValue(true);
    (mockSemanticCache.get as jest.Mock).mockResolvedValue({
      hit: true,
      data: { summary: 'Another candidate path', items: [] },
    });
    mockGemini.generateLearningPath.mockResolvedValueOnce({
      data: {
        summary: 'Candidate-specific learning path',
        items: [
          {
            gap: 'Concurrency',
            topic: 'Database transactions',
            priority: 'HIGH',
            recommendedAction: 'Practice transaction isolation and locking patterns.',
            searchKeywords: ['transaction isolation'],
          },
        ],
      },
      model: 'gemini-2.0-flash',
      provider: 'gemini',
      latencyMs: 100,
    });

    const result = await routerService.generateLearningPath(
      {
        role: 'Backend Engineer',
        level: 'Senior',
        overallScore: 7,
        turns: [
          {
            turnNumber: 1,
            question: 'How do transactions work?',
            answer: 'Candidate-specific answer',
            score: 7,
            strengths: ['Clear explanation'],
            improvements: ['Cover isolation anomalies'],
          },
        ],
      },
      'System prompt',
    );

    expect(result.provider).toBe('gemini');
    expect(mockGemini.generateLearningPath).toHaveBeenCalledTimes(1);
    expect(mockSemanticCache.get).not.toHaveBeenCalled();
    expect(mockSemanticCache.set).not.toHaveBeenCalled();
  });

  it('immediately skips without retrying on 400, 403, 404, 409, 422, or quota errors (PRD-1201)', async () => {
    for (const status of [400, 403, 404, 409, 422]) {
      jest.clearAllMocks();
      const nonRetryableError: any = new Error(`HTTP ${status} Client Error`);
      nonRetryableError.status = status;

      mockGemini.evaluateAnswer.mockRejectedValueOnce(nonRetryableError);
      mockOpenAi.evaluateAnswer.mockResolvedValueOnce({
        data: {
          score: 8.0,
          rubricScores: { technicalAccuracy: 8.0, depth: 8.0, clarity: 8.0 },
          strengths: ['Good'],
          improvements: ['None'],
          conciseFeedback: 'Good',
          evidence: [],
          confidence: 0.9,
          missingConcepts: [],
          needsReview: false,
        },
        model: 'gpt-4o',
        provider: 'openai',
        latencyMs: 150,
      });

      const result = await routerService.evaluateAnswer(
        { role: 'Dev', level: 'Senior', question: 'Q', answer: 'A' },
        'System prompt',
      );

      expect(mockGemini.evaluateAnswer).toHaveBeenCalledTimes(1); // No retries
      expect(result.provider).toBe('openai');
    }
  });

  it('enforces daily budget cap and skips paid providers when budget is exceeded (PRD-1202)', async () => {
    // Exceed daily budget
    (routerService as any).currentDailyCostUsd = 55.0; // above 50.0 cap

    mockGemini.evaluateAnswer.mockResolvedValueOnce({
      data: { score: 9.0 } as any,
      model: 'gemini-2.0-flash',
      provider: 'gemini',
      latencyMs: 50,
      costEstimate: 0.01,
    });

    const result = await routerService.evaluateAnswer(
      { role: 'Dev', level: 'Junior', question: 'Q', answer: 'A' },
      'System prompt',
    );

    // Paid provider should be skipped due to daily budget exhaustion
    expect(mockGemini.evaluateAnswer).not.toHaveBeenCalled();
    expect(result.provider).toBe('mock');
    expect(result.data.needsReview).toBe(true);
  });

  it('reserves the worst-case cost for every retry and settles successful usage', async () => {
    const reservation = {
      key: 'distributed-budget:ai-provider-global:2026-09-01',
      reservedMicros: 6_000_000,
    };
    const mockBudget = {
      reserve: jest.fn().mockResolvedValue(reservation),
      settle: jest.fn().mockResolvedValue(undefined),
    };
    (routerService as any).distributedBudget = mockBudget;

    mockGemini.evaluateAnswer
      .mockRejectedValueOnce(new Error('temporary provider failure'))
      .mockResolvedValueOnce({
        data: {
          score: 8,
          rubricScores: { technicalAccuracy: 8, depth: 8, clarity: 8 },
          strengths: ['Good'],
          improvements: [],
          conciseFeedback: 'Good',
          evidence: [],
          confidence: 0.9,
          missingConcepts: [],
          needsReview: false,
        },
        model: 'gemini-2.0-flash',
        provider: 'gemini',
        latencyMs: 100,
        costEstimate: 0.03,
      });

    const result = await routerService.evaluateAnswer(
      { role: 'Dev', level: 'Senior', question: 'Q', answer: 'A' },
      'System prompt',
    );

    expect(result.provider).toBe('gemini');
    expect(mockGemini.evaluateAnswer).toHaveBeenCalledTimes(2);
    expect(mockBudget.reserve).toHaveBeenCalledWith('ai-provider-global', 50, 6);
    expect(mockBudget.settle).toHaveBeenCalledWith(reservation, 2.03);
  });
});
