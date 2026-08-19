import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../platform/prisma/prisma.service';
import { PromptRegistryService } from './prompt-registry/prompt-registry.service';
import { MockAiProvider } from './providers/mock-ai.provider';
import { ExternalAiProvider } from './providers/external-ai.provider';
import {
  AiProvider,
  QuestionPromptContext,
  EvaluationPromptContext,
  LearningPathPromptContext,
} from './interfaces/ai-provider.interface';
import {
  GeneratedQuestionAi,
  GeneratedQuestionAiSchema,
  EvaluatedAnswerAi,
  EvaluatedAnswerAiSchema,
  GeneratedLearningPathAi,
  GeneratedLearningPathAiSchema,
  AiRunStatus,
  ErrorCode,
} from '@ai-interview/contracts';
import { DomainException } from '../platform/filters/all-exceptions.filter';

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);
  private provider: AiProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly mockProvider: MockAiProvider,
    private readonly externalProvider: ExternalAiProvider,
  ) {
    const configuredProvider = this.configService.get<string>('ai.provider', 'mock');
    this.provider = configuredProvider === 'external' ? this.externalProvider : this.mockProvider;
    this.logger.log(`AI Orchestrator initialized using [${this.provider.name}] provider`);
  }

  async generateQuestion(
    sessionId: string,
    context: QuestionPromptContext,
  ): Promise<GeneratedQuestionAi> {
    const promptRecord = await this.promptRegistry.getActivePrompt('question_generator');
    const startTime = Date.now();

    try {
      const result = await this.executeWithRetry(async () => {
        return this.provider.generateQuestion(context, promptRecord.systemPrompt);
      });

      const validated = GeneratedQuestionAiSchema.safeParse(result.data);
      if (!validated.success) {
        throw new DomainException(
          ErrorCode.AI_SCHEMA_INVALID,
          `AI output validation failed: ${validated.error.message}`,
        );
      }

      await this.auditRun({
        sessionId,
        promptVersionId: promptRecord.id,
        provider: result.provider,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        latencyMs: result.latencyMs || Date.now() - startTime,
        costEstimate: result.costEstimate,
        status: AiRunStatus.SUCCESS,
      });

      return validated.data;
    } catch (error: any) {
      await this.auditRun({
        sessionId,
        promptVersionId: promptRecord.id,
        provider: this.provider.name,
        model: 'unknown',
        latencyMs: Date.now() - startTime,
        status: AiRunStatus.FAILED,
        errorCode: error.code || ErrorCode.AI_GENERATION_FAILED,
        metadata: { message: error.message },
      });
      throw error;
    }
  }

  async evaluateAnswer(
    sessionId: string,
    context: EvaluationPromptContext,
  ): Promise<EvaluatedAnswerAi> {
    const promptRecord = await this.promptRegistry.getActivePrompt('answer_evaluator');
    const startTime = Date.now();

    try {
      const result = await this.executeWithRetry(async () => {
        return this.provider.evaluateAnswer(context, promptRecord.systemPrompt);
      });

      const validated = EvaluatedAnswerAiSchema.safeParse(result.data);
      if (!validated.success) {
        throw new DomainException(
          ErrorCode.AI_SCHEMA_INVALID,
          `AI evaluation output validation failed: ${validated.error.message}`,
        );
      }

      await this.auditRun({
        sessionId,
        promptVersionId: promptRecord.id,
        provider: result.provider,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        latencyMs: result.latencyMs || Date.now() - startTime,
        costEstimate: result.costEstimate,
        status: AiRunStatus.SUCCESS,
      });

      return validated.data;
    } catch (error: any) {
      await this.auditRun({
        sessionId,
        promptVersionId: promptRecord.id,
        provider: this.provider.name,
        model: 'unknown',
        latencyMs: Date.now() - startTime,
        status: AiRunStatus.FAILED,
        errorCode: error.code || ErrorCode.AI_EVALUATION_FAILED,
        metadata: { message: error.message },
      });
      throw error;
    }
  }

  async generateLearningPath(
    sessionId: string,
    context: LearningPathPromptContext,
  ): Promise<GeneratedLearningPathAi> {
    const promptRecord = await this.promptRegistry.getActivePrompt('learning_path');
    const startTime = Date.now();

    try {
      const result = await this.executeWithRetry(async () => {
        return this.provider.generateLearningPath(context, promptRecord.systemPrompt);
      });

      const validated = GeneratedLearningPathAiSchema.safeParse(result.data);
      if (!validated.success) {
        throw new DomainException(
          ErrorCode.AI_SCHEMA_INVALID,
          `AI learning path output validation failed: ${validated.error.message}`,
        );
      }

      await this.auditRun({
        sessionId,
        promptVersionId: promptRecord.id,
        provider: result.provider,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        latencyMs: result.latencyMs || Date.now() - startTime,
        costEstimate: result.costEstimate,
        status: AiRunStatus.SUCCESS,
      });

      return validated.data;
    } catch (error: any) {
      await this.auditRun({
        sessionId,
        promptVersionId: promptRecord.id,
        provider: this.provider.name,
        model: 'unknown',
        latencyMs: Date.now() - startTime,
        status: AiRunStatus.FAILED,
        errorCode: error.code || ErrorCode.AI_GENERATION_FAILED,
        metadata: { message: error.message },
      });
      throw error;
    }
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        if (attempt <= maxRetries) {
          const backoff = Math.pow(2, attempt) * 200;
          this.logger.warn(
            `AI invocation failed (attempt ${attempt}/${maxRetries + 1}). Retrying in ${backoff}ms... Error: ${error.message}`,
          );
          await new Promise(res => setTimeout(res, backoff));
        }
      }
    }
    throw lastError;
  }

  private async auditRun(data: {
    sessionId?: string;
    promptVersionId?: string;
    provider: string;
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    latencyMs: number;
    costEstimate?: number;
    status: AiRunStatus;
    errorCode?: string;
    metadata?: any;
  }) {
    try {
      await this.prisma.aiRun.create({
        data: {
          sessionId: data.sessionId,
          promptVersionId: data.promptVersionId,
          provider: data.provider,
          model: data.model,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalTokens: data.totalTokens,
          latencyMs: data.latencyMs,
          costEstimate: data.costEstimate,
          status: data.status,
          errorCode: data.errorCode,
          metadata: data.metadata,
        },
      });
    } catch (e: any) {
      this.logger.error('Failed to persist AI audit run', e.message);
    }
  }
}
