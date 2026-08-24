import { Injectable } from '@nestjs/common';
import { ProviderRouterService } from '../router/provider-router.service';
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
} from '@ai-interview/contracts';

/**
 * @deprecated Use `ProviderRouterService` or specific providers (`GeminiProvider`, `OpenAiProvider`, `AnthropicProvider`) directly.
 */
@Injectable()
export class ExternalAiProvider implements AiProvider {
  readonly name = 'external';

  constructor(private readonly routerService: ProviderRouterService) {}

  async generateQuestion(
    context: QuestionPromptContext,
    systemPrompt: string,
    userPrompt?: string,
  ): Promise<AiExecutionResult<GeneratedQuestionAi>> {
    return this.routerService.generateQuestion(context, systemPrompt, userPrompt);
  }

  async evaluateAnswer(
    context: EvaluationPromptContext,
    systemPrompt: string,
    userPrompt?: string,
  ): Promise<AiExecutionResult<EvaluatedAnswerAi>> {
    return this.routerService.evaluateAnswer(context, systemPrompt, userPrompt);
  }

  async generateLearningPath(
    context: LearningPathPromptContext,
    systemPrompt: string,
    userPrompt?: string,
  ): Promise<AiExecutionResult<GeneratedLearningPathAi>> {
    return this.routerService.generateLearningPath(context, systemPrompt, userPrompt);
  }
}
