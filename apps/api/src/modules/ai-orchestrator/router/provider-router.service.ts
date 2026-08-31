import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider,
  QuestionPromptContext,
  EvaluationPromptContext,
  LearningPathPromptContext,
  SocraticChatContext,
  SocraticChatResult,
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
import {
  BudgetReservation,
  DistributedBudgetService,
} from '../../platform/budget/distributed-budget.service';

@Injectable()
export class ProviderRouterService {
  private readonly logger = new Logger(ProviderRouterService.name);
  private readonly providersMap = new Map<string, AiProvider>();
  private readonly circuitBreaker: CircuitBreaker;
  private readonly dailyBudgetUsd: number;
  private readonly maxProviderCallCostUsd: number;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private currentDailyCostUsd = 0;
  private lastBudgetResetDay = new Date().getUTCDate();

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiProvider: GeminiProvider,
    private readonly openAiProvider: OpenAiProvider,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly mockProvider: MockAiProvider,
    private readonly semanticCacheService: SemanticCacheService,
    @Optional() private readonly distributedBudget?: DistributedBudgetService,
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
    this.maxProviderCallCostUsd = this.configService.get<number>('ai.maxProviderCallCostUsd', 2.0);
    this.maxRetries = this.configService.get<number>('ai.maxRetries', 2);
    this.timeoutMs = this.configService.get<number>('ai.timeoutMs', 10_000);
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

  async getCurrentDailyCostUsd(): Promise<number> {
    if (this.distributedBudget) {
      try {
        return await this.distributedBudget.getCurrentUsd('ai-provider-global');
      } catch (error: any) {
        this.logger.error(`Unable to read distributed AI budget: ${error.message}`);
        if (process.env.NODE_ENV === 'production') throw error;
      }
    }
    this.checkDailyBudget(0);
    return this.currentDailyCostUsd;
  }

  /**
   * Resolves the ordered list of provider names to try.
   */
  getPriorityChain(): string[] {
    const configuredProvider = this.configService.get<string>('ai.provider', 'mock').toLowerCase();
    const isProduction = process.env.NODE_ENV === 'production';
    const rawEnvProvider = process.env.AI_PROVIDER;
    const openaiKey = this.configService.get<string>('ai.openaiApiKey', '');
    const geminiKey = this.configService.get<string>('ai.geminiApiKey', '');
    const anthropicKey = this.configService.get<string>('ai.anthropicApiKey', '');

    if (configuredProvider === 'mock') {
      // If user supplied real LLM API keys in .env without explicitly setting AI_PROVIDER='mock', auto-route to real LLM
      if (!rawEnvProvider && (geminiKey || openaiKey || anthropicKey)) {
        const available: string[] = [];
        if (geminiKey) available.push('gemini');
        if (openaiKey) available.push('openai');
        if (anthropicKey) available.push('anthropic');
        if (!isProduction) available.push('mock');
        this.logger.log(
          `Auto-detected LLM API keys in environment. Using priority chain: [${available.join(', ')}]`,
        );
        return available;
      }

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

    const allowMock = !isProduction || process.env.AI_ALLOW_MOCK === 'true';
    const parsed = rawPriority
      .split(',')
      .map(p => p.trim().toLowerCase())
      .filter(p => this.providersMap.has(p) && (p !== 'mock' || allowMock));

    if (!isProduction && !parsed.includes('mock')) {
      parsed.push('mock');
    }

    if (parsed.length === 0 && isProduction) {
      throw new Error('No production AI provider configured');
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
    operation:
      'generateQuestion' | 'evaluateAnswer' | 'generateLearningPath' | 'streamSocraticChat',
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
      let budgetReservation: BudgetReservation | null | undefined;

      try {
        if (providerName !== 'mock') {
          budgetReservation = await this.reserveDistributedBudget(operation, providerName);
          if (budgetReservation === null) {
            this.logger.warn(`Skipping paid provider [${providerName}] due to global budget cap.`);
            continue;
          }
        }

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

        if (budgetReservation) {
          await this.distributedBudget!.settle(budgetReservation, result.costEstimate || 0);
          this.checkDailyBudget(result.costEstimate || 0);
          budgetReservation = undefined;
        } else if (result.costEstimate) {
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
        // The upstream request may have been billed even when its response was
        // lost. Keep the maximum reservation on ambiguous provider failures;
        // releasing it would let retries overspend the global daily cap.
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

  private async reserveDistributedBudget(
    operation: string,
    providerName: string,
  ): Promise<BudgetReservation | undefined | null> {
    if (!this.distributedBudget) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Distributed AI budget enforcement is unavailable');
      }
      return this.checkDailyBudget(0) ? undefined : null;
    }

    try {
      return await this.distributedBudget.reserve(
        'ai-provider-global',
        this.dailyBudgetUsd,
        this.maxProviderCallCostUsd,
      );
    } catch (error: any) {
      this.logger.error(
        `Global AI budget reservation failed for [${providerName}:${operation}]: ${error.message}`,
      );
      if (process.env.NODE_ENV === 'production') throw error;
      return this.checkDailyBudget(0) ? undefined : null;
    }
  }

  private isNonRetryableError(error: any): boolean {
    const status = error.status || error.statusCode || error.response?.status;
    if (status && [400, 401, 403, 404, 409, 422].includes(status)) {
      return true;
    }
    const message = (error.message || '').toLowerCase();
    if (
      message.includes('api key') ||
      message.includes('authentication') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('quota') ||
      message.includes('budget') ||
      message.includes('invalid schema')
    ) {
      return true;
    }
    return false;
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = this.maxRetries,
  ): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Immediately throw on 400/401/403/404/409/422 or auth/quota/validation errors (no retry per DEC-007)
        if (this.isNonRetryableError(error)) {
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
    // SECURITY: Semantic cache disabled for evaluations to prevent cross-user leakage
    // and ensure each evaluation uses current prompt/rubric/model version.
    // See audit finding F-009.

    const result = await this.executeWithFallback('evaluateAnswer', provider =>
      provider.evaluateAnswer(context, systemPrompt, userPrompt),
    );

    // Cache set removed for evaluations (F-009)

    return result;
  }

  async generateLearningPath(
    context: LearningPathPromptContext,
    systemPrompt: string,
    userPrompt?: string,
  ): Promise<AiExecutionResult<GeneratedLearningPathAi>> {
    // Personalized learning paths include candidate answers and feedback, so a shared semantic
    // cache can leak one candidate's generated output to another candidate.
    return this.executeWithFallback('generateLearningPath', provider =>
      provider.generateLearningPath(context, systemPrompt, userPrompt),
    );
  }

  async streamSocraticChat(
    context: SocraticChatContext,
    systemPrompt: string,
    onToken?: (token: string) => void,
  ): Promise<AiExecutionResult<SocraticChatResult>> {
    return this.executeWithFallback('streamSocraticChat', provider => {
      if (provider.streamSocraticChat) {
        return provider.streamSocraticChat(context, systemPrompt, onToken);
      }
      throw new Error(`Provider ${provider.name} does not implement streamSocraticChat`);
    });
  }
}
