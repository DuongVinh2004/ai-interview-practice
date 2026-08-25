import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { PromptRegistryService } from './prompt-registry/prompt-registry.service';
import { PromptRendererService } from './prompt-engine/prompt-renderer.service';
import { AiSecurityFilterService } from './security/ai-security-filter.service';
import { ProviderRouterService } from './router/provider-router.service';
import {
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly promptRenderer: PromptRendererService,
    private readonly securityFilter: AiSecurityFilterService,
    private readonly routerService: ProviderRouterService,
  ) {
    this.logger.log(
      `AI Orchestrator initialized with ProviderRouter (Chain: ${this.routerService.getPriorityChain().join(' -> ')})`,
    );
  }

  async generateQuestion(
    sessionId: string,
    context: QuestionPromptContext,
  ): Promise<GeneratedQuestionAi> {
    const promptRecord = await this.promptRegistry.getActivePrompt('question_generator');
    const userPrompt = this.promptRenderer.renderQuestionPrompt(
      promptRecord.userPromptTemplate,
      context,
    );
    const startTime = Date.now();

    try {
      const result = await this.routerService.generateQuestion(
        context,
        promptRecord.systemPrompt,
        userPrompt,
      );

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
        provider: 'router',
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
    const startTime = Date.now();

    // 1. Pre-execution Safety Filter (Prompt injection, Protected traits, Verbosity spam)
    const preFilterResult = this.securityFilter.preFilter(context);
    if (!preFilterResult.isSafe && preFilterResult.directEvaluation) {
      const filtered = this.securityFilter.postFilter(context, preFilterResult.directEvaluation);
      await this.auditRun({
        sessionId,
        provider: 'security-filter',
        model: 'heuristic-guard-v1',
        latencyMs: Date.now() - startTime,
        status: AiRunStatus.SUCCESS,
        metadata: { safetyFlags: preFilterResult.safetyFlags },
      });
      return filtered;
    }

    const promptRecord = await this.promptRegistry.getActivePrompt('answer_evaluator');
    const userPrompt = this.promptRenderer.renderEvaluationPrompt(
      promptRecord.userPromptTemplate,
      context,
    );

    try {
      const result = await this.routerService.evaluateAnswer(
        context,
        promptRecord.systemPrompt,
        userPrompt,
      );

      const validated = EvaluatedAnswerAiSchema.safeParse(result.data);
      if (!validated.success) {
        throw new DomainException(
          ErrorCode.AI_SCHEMA_INVALID,
          `AI evaluation output validation failed: ${validated.error.message}`,
        );
      }

      // 2. Post-execution Safety Filter (Verbatim Evidence Check, Deterministic Application Score Calculation)
      const postProcessed = this.securityFilter.postFilter(context, validated.data);

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
        metadata: postProcessed.safetyFlags
          ? { safetyFlags: postProcessed.safetyFlags }
          : undefined,
      });

      return postProcessed;
    } catch (error: any) {
      await this.auditRun({
        sessionId,
        promptVersionId: promptRecord.id,
        provider: 'router',
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
    const userPrompt = this.promptRenderer.renderLearningPathPrompt(
      promptRecord.userPromptTemplate,
      context,
    );
    const startTime = Date.now();

    try {
      const result = await this.routerService.generateLearningPath(
        context,
        promptRecord.systemPrompt,
        userPrompt,
      );

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
        provider: 'router',
        model: 'unknown',
        latencyMs: Date.now() - startTime,
        status: AiRunStatus.FAILED,
        errorCode: error.code || ErrorCode.AI_GENERATION_FAILED,
        metadata: { message: error.message },
      });
      throw error;
    }
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
