import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider,
  QuestionPromptContext,
  EvaluationPromptContext,
  LearningPathPromptContext,
  AiExecutionResult,
} from '../interfaces/ai-provider.interface';
import {
  GeneratedQuestionAi,
  EvaluatedAnswerAi,
  GeneratedLearningPathAi,
  ErrorCode,
} from '@ai-interview/contracts';
import { GeminiProvider } from '../providers/gemini.provider';
import { OpenAiProvider } from '../providers/openai.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { MockAiProvider } from '../providers/mock-ai.provider';
import { CircuitBreaker } from '../resilience/circuit-breaker';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { MetricsService } from '../../platform/metrics/metrics.service';
import { TelemetryService } from '../../platform/telemetry/telemetry.service';
import { SemanticCacheService } from '../cache/semantic-cache.service';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class ProviderRouterService {
  private readonly logger = new Logger(ProviderRouterService.name);
  private readonly providersMap = new Map<string, AiProvider>();
  private readonly circuitBreaker: CircuitBreaker;
  private readonly dailyBudgetUsd: number;
  private currentDailyCostUsd = 0;
  private lastBudgetResetDay = new Date().getUTCDate();

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiProvider: GeminiProvider,
    private readonly openAiProvider: OpenAiProvider,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly mockProvider: MockAiProvider,
    private readonly semanticCacheService: SemanticCacheService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly metricsService?: MetricsService,
    @Optional() private readonly telemetryService?: TelemetryService,
  ) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      windowMs: 60_000,
      resetTimeoutMs: 30_000,
    });

    this.providersMap.set('gemini', this.geminiProvider);
    this.providersMap.set('openai', this.openAiProvider);
    this.providersMap.set('anthropic', this.anthropicProvider);
    this.providersMap.set('mock', this.mockProvider);

    this.dailyBudgetUsd = this.configService.get<number>('ai.dailyBudgetUsd', 50.0);
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  getCircuitBreakerStates() {
    return this.circuitBreaker.getAllStates();
  }

  getDailyBudgetUsd(): number {
    return this.dailyBudgetUsd;
  }

  getCurrentDailyCostUsd(): number {
    this.checkDailyBudget(0);
    return this.currentDailyCostUsd;
  }

  /**
   * Resolves the ordered list of provider names to try.
   */
  getPriorityChain(): string[] {
    const configuredProvider = this.configService.get<string>('ai.provider', 'mock').toLowerCase();
    const isProduction = process.env.NODE_ENV === 'production';

    if (configuredProvider === 'mock') {
      if (isProduction && process.env.AI_ALLOW_MOCK !== 'true') {
        this.logger.error(
          'AI_PROVIDER=mock configured in production environment without explicit override!',
        );
        throw new Error('Mock AI provider cannot be primary provider in production');
      }
      return ['mock'];
    }

    if (configuredProvider === 'gemini') {
      return isProduction ? ['gemini'] : ['gemini', 'mock'];
    }

    if (configuredProvider === 'openai') {
      return isProduction ? ['openai'] : ['openai', 'mock'];
    }

    if (configuredProvider === 'anthropic') {
      return isProduction ? ['anthropic'] : ['anthropic', 'mock'];
    }

    // Default or 'router' / 'external': Parse AI_PROVIDER_PRIORITY
    const rawPriority = this.configService.get<string>(
      'ai.providerPriority',
      'gemini,openai,anthropic,mock',
    );

    const parsed = rawPriority
      .split(',')
      .map(p => p.trim().toLowerCase())
      .filter(p => this.providersMap.has(p));

    if (!isProduction && !parsed.includes('mock')) {
      parsed.push('mock');
    }

    return parsed.length > 0 ? parsed : ['mock'];
  }

  /**
   * Checks and updates daily cost accumulator (H-007).
   */
  private checkDailyBudget(costToAdd: number = 0): boolean {
    const currentDay = new Date().getUTCDate();
    if (currentDay !== this.lastBudgetResetDay) {
      this.currentDailyCostUsd = 0;
      this.lastBudgetResetDay = currentDay;
    }

    this.currentDailyCostUsd += costToAdd;

    if (this.currentDailyCostUsd >= this.dailyBudgetUsd) {
      this.logger.warn(
        `Daily AI budget of $${this.dailyBudgetUsd.toFixed(2)} exceeded (Current: $${this.currentDailyCostUsd.toFixed(2)}). Switching to zero-cost fallback mode.`,
      );
      return false;
    }

    return true;
  }

  async syncDailyBudgetFromDb(): Promise<void> {
    if (this.prisma) {
      try {
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const agg = await this.prisma.aiRun.aggregate({
          where: { createdAt: { gte: startOfDay } },
          _sum: { costEstimate: true },
        });
        const dbTotal = agg._sum.costEstimate || 0;
        this.currentDailyCostUsd = Math.max(this.currentDailyCostUsd, dbTotal);
      } catch {
        // Fallback to in-memory accumulator on DB read failure
      }
    }
  }

  /**
   * Generic execution wrapper that tries providers in priority order with intelligent fallback.
   */
  async executeWithFallback<T>(
    operation: 'generateQuestion' | 'evaluateAnswer' | 'generateLearningPath',
    invokeFn: (provider: AiProvider) => Promise<AiExecutionResult<T>>,
  ): Promise<AiExecutionResult<T>> {
    await this.syncDailyBudgetFromDb();
    const priorityChain = this.getPriorityChain();
    let lastError: any = null;
    let attemptedProviders = 0;

    for (let i = 0; i < priorityChain.length; i++) {
      const providerName = priorityChain[i];
      const provider = this.providersMap.get(providerName);

      if (!provider) continue;

      // Check daily budget limit for paid providers
      if (providerName !== 'mock' && !this.checkDailyBudget(0)) {
        this.logger.warn(`Skipping paid provider [${providerName}] due to budget cap.`);
        continue;
      }

      // Check circuit breaker status
      if (!this.circuitBreaker.canExecute(providerName, operation)) {
        this.logger.warn(
          `Circuit breaker OPEN for [${providerName}:${operation}]. Cascading to next provider.`,
        );
        this.metricsService?.aiCircuitBreakerState.set({ provider: providerName, operation }, 2);
        continue;
      }

      attemptedProviders++;
      const startTime = Date.now();

      try {
        const result = await this.circuitBreaker.execute(providerName, operation, async () => {
          return await this.executeWithRetry(() => invokeFn(provider));
        });

        const durationSec = (Date.now() - startTime) / 1000;
        this.metricsService?.aiProviderRequestsTotal.inc({
          provider: providerName,
          operation,
          status: 'success',
        });
        this.metricsService?.aiProviderLatencySeconds.observe(
          { provider: providerName, operation },
          durationSec,
        );
        this.metricsService?.aiCircuitBreakerState.set({ provider: providerName, operation }, 0);

        if (result.promptTokens || result.completionTokens) {
          const modelName = result.model || 'default';
          if (result.promptTokens) {
            this.metricsService?.aiTokensTotal.inc(
              { provider: providerName, model: modelName, token_type: 'prompt' },
              result.promptTokens,
            );
          }
          if (result.completionTokens) {
            this.metricsService?.aiTokensTotal.inc(
              { provider: providerName, model: modelName, token_type: 'completion' },
              result.completionTokens,
            );
          }
        }

        if (result.costEstimate) {
          this.checkDailyBudget(result.costEstimate);
          this.metricsService?.aiCostUsdTotal.inc(
            { provider: providerName, model: result.model || 'default' },
            result.costEstimate,
          );
        }

        // If provider is mock (either primary or fallback), always mark needsReview and record metric
        if (providerName === 'mock' && result.data && typeof result.data === 'object') {
          const dataObj = result.data as any;
          if ('needsReview' in dataObj) {
            dataObj.needsReview = true;
          }
          dataObj.isMockProvider = true;
          this.metricsService?.evaluationNeedsReviewTotal.inc({ reason: 'ai_provider_fallback' });
        }

        return result;
      } catch (error: any) {
        lastError = error;
        const durationSec = (Date.now() - startTime) / 1000;
        this.metricsService?.aiProviderRequestsTotal.inc({
          provider: providerName,
          operation,
          status: 'error',
        });
        this.metricsService?.aiProviderLatencySeconds.observe(
          { provider: providerName, operation },
          durationSec,
        );

        if (!this.circuitBreaker.canExecute(providerName, operation)) {
          this.metricsService?.aiCircuitBreakerState.set({ provider: providerName, operation }, 2);
          this.metricsService?.aiCircuitBreakerTripsTotal.inc({
            provider: providerName,
            operation,
          });
        }

        this.logger.error(
          `Provider [${providerName}] failed for operation [${operation}]: ${error.message}. Cascading to next fallback...`,
        );
      }
    }

    throw (
      lastError ||
      new DomainException(
        ErrorCode.AI_GENERATION_FAILED,
        'All AI providers in fallback chain failed to produce a response.',
        500,
      )
    );
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Immediately throw on 401/403 authentication/credential errors (no retry)
        const isAuthError =
          error.status === 401 ||
          error.status === 403 ||
          error.message?.includes('API key') ||
          error.message?.includes('authentication');

        if (isAuthError) {
          throw error;
        }

        if (attempt <= maxRetries) {
          const backoff = Math.pow(2, attempt) * 200;
          this.logger.warn(
            `Transient error in AI call (attempt ${attempt}/${maxRetries + 1}). Retrying in ${backoff}ms... Error: ${error.message}`,
          );
          await new Promise(res => setTimeout(res, backoff));
        }
      }
    }
    throw lastError;
  }

  async generateQuestion(
    context: QuestionPromptContext,
    systemPrompt: string,
    userPrompt?: string,
  ): Promise<AiExecutionResult<GeneratedQuestionAi>> {
    const cacheKey = `question:${context.role}:${context.level}:${context.technologies?.join(',')}:${context.turnNumber}:${context.difficulty}:${userPrompt || ''}`;

    if (this.semanticCacheService?.isCacheEnabled()) {
      const cached = await this.semanticCacheService.get<GeneratedQuestionAi>(cacheKey, undefined, {
        namespace: 'questions',
      });
      if (cached.hit && cached.data) {
        return {
          data: cached.data,
          provider: 'semantic_cache',
          model: 'semantic-cache',
          latencyMs: 15,
          promptTokens: 0,
          completionTokens: 0,
          costEstimate: 0,
        };
      }
    }

    const result = await this.executeWithFallback('generateQuestion', provider =>
      provider.generateQuestion(context, systemPrompt, userPrompt),
    );

    if (this.semanticCacheService?.isCacheEnabled() && result.data && result.provider !== 'mock') {
      await this.semanticCacheService.set(
        cacheKey,
        result.data,
        { operation: 'generateQuestion' },
        86400,
        { namespace: 'questions' },
      );
    }

    return result;
  }

  async evaluateAnswer(
    context: EvaluationPromptContext,
    systemPrompt: string,
    userPrompt?: string,
  ): Promise<AiExecutionResult<EvaluatedAnswerAi>> {
    const cacheKey = `eval:${context.question}:${context.answer}:${context.level}`;

    if (this.semanticCacheService?.isCacheEnabled()) {
      const cached = await this.semanticCacheService.get<EvaluatedAnswerAi>(cacheKey, undefined, {
        namespace: 'evaluations',
      });
      if (cached.hit && cached.data) {
        return {
          data: cached.data,
          provider: 'semantic_cache',
          model: 'semantic-cache',
          latencyMs: 15,
          promptTokens: 0,
          completionTokens: 0,
          costEstimate: 0,
        };
      }
    }

    const result = await this.executeWithFallback('evaluateAnswer', provider =>
      provider.evaluateAnswer(context, systemPrompt, userPrompt),
    );

    if (this.semanticCacheService?.isCacheEnabled() && result.data && result.provider !== 'mock') {
      await this.semanticCacheService.set(
        cacheKey,
        result.data,
        { operation: 'evaluateAnswer' },
        86400,
        { namespace: 'evaluations' },
      );
    }

    return result;
  }

  async generateLearningPath(
    context: LearningPathPromptContext,
    systemPrompt: string,
    userPrompt?: string,
  ): Promise<AiExecutionResult<GeneratedLearningPathAi>> {
    const cacheKey = `learning-path:${context.role}:${context.level}:${context.turns?.map(t => `${t.turnNumber}:${t.score}`).join(',')}`;

    if (this.semanticCacheService?.isCacheEnabled()) {
      const cached = await this.semanticCacheService.get<GeneratedLearningPathAi>(
        cacheKey,
        undefined,
        {
          namespace: 'learning_paths',
        },
      );
      if (cached.hit && cached.data) {
        return {
          data: cached.data,
          provider: 'semantic_cache',
          model: 'semantic-cache',
          latencyMs: 15,
          promptTokens: 0,
          completionTokens: 0,
          costEstimate: 0,
        };
      }
    }

    const result = await this.executeWithFallback('generateLearningPath', provider =>
      provider.generateLearningPath(context, systemPrompt, userPrompt),
    );

    if (this.semanticCacheService?.isCacheEnabled() && result.data && result.provider !== 'mock') {
      await this.semanticCacheService.set(
        cacheKey,
        result.data,
        { operation: 'generateLearningPath' },
        86400,
        { namespace: 'learning_paths' },
      );
    }

    return result;
  }
}
