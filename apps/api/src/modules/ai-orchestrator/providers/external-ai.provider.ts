import { Injectable, Logger } from '@nestjs/common';
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
import { DomainException } from '../../platform/filters/all-exceptions.filter';

@Injectable()
export class ExternalAiProvider implements AiProvider {
  readonly name = 'external';
  private readonly logger = new Logger(ExternalAiProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private validateCredentials() {
    const openaiKey = this.configService.get<string>('ai.openaiApiKey');
    const anthropicKey = this.configService.get<string>('ai.anthropicApiKey');
    const geminiKey = this.configService.get<string>('ai.geminiApiKey');

    if (!openaiKey && !anthropicKey && !geminiKey) {
      throw new DomainException(
        ErrorCode.AI_GENERATION_FAILED,
        'External AI Provider is enabled but no API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY) are configured in the environment.',
        500,
      );
    }
  }

  async generateQuestion(
    context: QuestionPromptContext,
    systemPrompt: string,
  ): Promise<AiExecutionResult<GeneratedQuestionAi>> {
    this.validateCredentials();
    // External API invocation placeholder
    throw new DomainException(
      ErrorCode.AI_GENERATION_FAILED,
      'External AI invocation failed: External API connection not configured for live calls in this environment.',
      500,
    );
  }

  async evaluateAnswer(
    context: EvaluationPromptContext,
    systemPrompt: string,
  ): Promise<AiExecutionResult<EvaluatedAnswerAi>> {
    this.validateCredentials();
    throw new DomainException(
      ErrorCode.AI_EVALUATION_FAILED,
      'External AI invocation failed: External API connection not configured for live calls in this environment.',
      500,
    );
  }

  async generateLearningPath(
    context: LearningPathPromptContext,
    systemPrompt: string,
  ): Promise<AiExecutionResult<GeneratedLearningPathAi>> {
    this.validateCredentials();
    throw new DomainException(
      ErrorCode.AI_GENERATION_FAILED,
      'External AI invocation failed: External API connection not configured for live calls in this environment.',
      500,
    );
  }
}
