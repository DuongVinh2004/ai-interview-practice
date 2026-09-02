import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
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
  GeneratedQuestionAiSchema,
  EvaluatedAnswerAi,
  EvaluatedAnswerAiSchema,
  GeneratedLearningPathAi,
  GeneratedLearningPathAiSchema,
  ErrorCode,
} from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { toAnthropicTool, AI_SCHEMAS } from '../utils/zod-to-json-schema.util';

@Injectable()
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);
  private client: Anthropic | null = null;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ai.anthropicApiKey', '');
    this.defaultModel = this.configService.get<string>(
      'ai.anthropicModel',
      'claude-sonnet-4-20250514',
    );
    const timeout = this.configService.get<number>('ai.timeoutMs', 10000);
    const maxRetries = this.configService.get<number>('ai.maxRetries', 2);

    if (apiKey) {
      this.client = new Anthropic({ apiKey, timeout, maxRetries });
    }
  }

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = this.configService.get<string>('ai.anthropicApiKey', '');
      if (!apiKey) {
        throw new DomainException(
          ErrorCode.AI_GENERATION_FAILED,
          'Anthropic API key is not configured.',
          401,
        );
      }
      const timeout = this.configService.get<number>('ai.timeoutMs', 10000);
      const maxRetries = this.configService.get<number>('ai.maxRetries', 2);
      this.client = new Anthropic({ apiKey, timeout, maxRetries });
    }
    return this.client;
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    // Claude 3.5 Sonnet / Claude 4 Sonnet: $3.00 / 1M input, $15.00 / 1M output
    const promptCost = (inputTokens / 1_000_000) * 3.0;
    const completionCost = (outputTokens / 1_000_000) * 15.0;
    return Number((promptCost + completionCost).toFixed(6));
  }

  async generateQuestion(
    context: QuestionPromptContext,
    systemPrompt: string,
    userPrompt?: string,
  ): Promise<AiExecutionResult<GeneratedQuestionAi>> {
    const startTime = Date.now();
    const client = this.getClient();

    const promptText =
      userPrompt ||
      `Role: ${context.role}\nLevel: ${context.level}\nTechnologies: ${context.technologies.join(', ')}\nTurn: ${context.turnNumber}\nDifficulty: ${context.difficulty}`;

    const toolDef = toAnthropicTool(
      AI_SCHEMAS.question.zod,
      AI_SCHEMAS.question.name,
      AI_SCHEMAS.question.description,
    );

    try {
      const response = await client.messages.create({
        model: this.defaultModel,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: promptText }],
        tools: [toolDef as any],
        tool_choice: { type: 'tool', name: AI_SCHEMAS.question.name },
      });

      const latencyMs = Date.now() - startTime;
      const toolUseBlock = response.content.find((block: any) => block.type === 'tool_use') as any;

      if (!toolUseBlock || !toolUseBlock.input) {
        throw new Error('Anthropic did not return expected tool_use block');
      }

      const validated = GeneratedQuestionAiSchema.parse(toolUseBlock.input);

      const promptTokens = response.usage?.input_tokens || 200;
      const completionTokens = response.usage?.output_tokens || 100;
      const totalTokens = promptTokens + completionTokens;

      return {
        data: validated,
        model: this.defaultModel,
        provider: this.name,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs,
        costEstimate: this.calculateCost(promptTokens, completionTokens),
      };
    } catch (error: any) {
      this.logger.error(`Anthropic generateQuestion failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AI_GENERATION_FAILED,
        `Anthropic API invocation failed: ${error.message}`,
        error.status || 500,
      );
    }
  }

  async evaluateAnswer(
    context: EvaluationPromptContext,
    systemPrompt: string,
    userPrompt?: string,
  ): Promise<AiExecutionResult<EvaluatedAnswerAi>> {
    const startTime = Date.now();
    const client = this.getClient();

    const promptText =
      userPrompt ||
      `Question: ${context.question}\nKey Focus: ${context.keyFocus || 'General'}\nCandidate Answer: ${context.answer}\nRole: ${context.role} (${context.level})`;

    const toolDef = toAnthropicTool(
      AI_SCHEMAS.evaluation.zod,
      AI_SCHEMAS.evaluation.name,
      AI_SCHEMAS.evaluation.description,
    );

    try {
      const response = await client.messages.create({
        model: this.defaultModel,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: promptText }],
        tools: [toolDef as any],
        tool_choice: { type: 'tool', name: AI_SCHEMAS.evaluation.name },
      });

      const latencyMs = Date.now() - startTime;
      const toolUseBlock = response.content.find((block: any) => block.type === 'tool_use') as any;

      if (!toolUseBlock || !toolUseBlock.input) {
        throw new Error('Anthropic did not return expected tool_use block');
      }

      const validated = EvaluatedAnswerAiSchema.parse(toolUseBlock.input);

      const promptTokens = response.usage?.input_tokens || 300;
      const completionTokens = response.usage?.output_tokens || 150;
      const totalTokens = promptTokens + completionTokens;

      return {
        data: validated,
        model: this.defaultModel,
        provider: this.name,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs,
        costEstimate: this.calculateCost(promptTokens, completionTokens),
      };
    } catch (error: any) {
      this.logger.error(`Anthropic evaluateAnswer failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AI_EVALUATION_FAILED,
        `Anthropic API evaluation failed: ${error.message}`,
        error.status || 500,
      );
    }
  }

  async generateLearningPath(
    context: LearningPathPromptContext,
    systemPrompt: string,
    userPrompt?: string,
  ): Promise<AiExecutionResult<GeneratedLearningPathAi>> {
    const startTime = Date.now();
    const client = this.getClient();

    const promptText =
      userPrompt ||
      `Role: ${context.role} (${context.level})\nOverall Score: ${context.overallScore}/10\nTurns Count: ${context.turns.length}`;

    const toolDef = toAnthropicTool(
      AI_SCHEMAS.learningPath.zod,
      AI_SCHEMAS.learningPath.name,
      AI_SCHEMAS.learningPath.description,
    );

    try {
      const response = await client.messages.create({
        model: this.defaultModel,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: promptText }],
        tools: [toolDef as any],
        tool_choice: { type: 'tool', name: AI_SCHEMAS.learningPath.name },
      });

      const latencyMs = Date.now() - startTime;
      const toolUseBlock = response.content.find((block: any) => block.type === 'tool_use') as any;

      if (!toolUseBlock || !toolUseBlock.input) {
        throw new Error('Anthropic did not return expected tool_use block');
      }

      const validated = GeneratedLearningPathAiSchema.parse(toolUseBlock.input);

      const promptTokens = response.usage?.input_tokens || 400;
      const completionTokens = response.usage?.output_tokens || 250;
      const totalTokens = promptTokens + completionTokens;

      return {
        data: validated,
        model: this.defaultModel,
        provider: this.name,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs,
        costEstimate: this.calculateCost(promptTokens, completionTokens),
      };
    } catch (error: any) {
      this.logger.error(`Anthropic generateLearningPath failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AI_GENERATION_FAILED,
        `Anthropic API learning path generation failed: ${error.message}`,
        error.status || 500,
      );
    }
  }

  async streamSocraticChat(
    context: SocraticChatContext,
    systemPrompt: string,
    onToken?: (token: string) => void,
  ): Promise<AiExecutionResult<SocraticChatResult>> {
    const client = this.getClient();
    const startTime = Date.now();

    try {
      const messages: Anthropic.MessageParam[] = [];
      for (const msg of context.chatHistory || []) {
        const role = msg.role === 'AI_TUTOR' || msg.role === 'assistant' ? 'assistant' : 'user';
        messages.push({ role, content: msg.content });
      }
      messages.push({ role: 'user', content: context.userMessage });

      let fullText = '';
      const stream = client.messages.stream({
        model: this.defaultModel,
        max_tokens: 800,
        temperature: 0.6,
        system: systemPrompt,
        messages,
      });

      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta' &&
          chunk.delta.text
        ) {
          fullText += chunk.delta.text;
          onToken?.(chunk.delta.text);
        }
      }

      const docReferences = [
        {
          title: 'Official Documentation & Best Practices',
          url: 'https://developer.mozilla.org',
        },
      ];

      const promptLength = messages.reduce(
        (sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0),
        0,
      );
      const promptTokens = Math.round(promptLength / 4);
      const completionTokens = Math.round(fullText.length / 4);
      const totalTokens = promptTokens + completionTokens;

      return {
        data: {
          fullText,
          references: docReferences,
        },
        model: this.defaultModel,
        provider: this.name,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs: Date.now() - startTime,
        costEstimate: this.calculateCost(promptTokens, completionTokens),
      };
    } catch (error: any) {
      this.logger.error(`Anthropic streamSocraticChat failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AI_GENERATION_FAILED,
        `Anthropic API socratic chat failed: ${error.message}`,
        error.status || 500,
      );
    }
  }
}
