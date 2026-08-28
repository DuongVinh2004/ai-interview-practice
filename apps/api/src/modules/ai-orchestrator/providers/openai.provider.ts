import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
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
import { toOpenAiResponseFormat, AI_SCHEMAS } from '../utils/zod-to-json-schema.util';

@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);
  private client: OpenAI | null = null;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ai.openaiApiKey', '');
    this.defaultModel = this.configService.get<string>('ai.openaiModel', 'gpt-4o');

    if (apiKey) {
      this.client = new OpenAI({ apiKey, timeout: 25000 });
    }
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('ai.openaiApiKey', '');
      if (!apiKey) {
        throw new DomainException(
          ErrorCode.AI_GENERATION_FAILED,
          'OpenAI API key is not configured.',
          401,
        );
      }
      this.client = new OpenAI({ apiKey, timeout: 25000 });
    }
    return this.client;
  }

  private calculateCost(promptTokens: number, completionTokens: number): number {
    const isMini = this.defaultModel.toLowerCase().includes('mini');
    const promptRate = isMini ? 0.15 : 2.5; // per 1M tokens
    const completionRate = isMini ? 0.6 : 10.0; // per 1M tokens

    const promptCost = (promptTokens / 1_000_000) * promptRate;
    const completionCost = (completionTokens / 1_000_000) * completionRate;
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

    try {
      const response = await client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptText },
        ],
        response_format: toOpenAiResponseFormat(AI_SCHEMAS.question.zod, 'GeneratedQuestion'),
        temperature: 0.7,
      });

      const latencyMs = Date.now() - startTime;
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI returned empty message content');
      }

      const parsed = JSON.parse(content);
      const validated = GeneratedQuestionAiSchema.parse(parsed);

      const promptTokens = response.usage?.prompt_tokens || 200;
      const completionTokens = response.usage?.completion_tokens || 100;
      const totalTokens = response.usage?.total_tokens || promptTokens + completionTokens;

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
      this.logger.error(`OpenAI generateQuestion failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AI_GENERATION_FAILED,
        `OpenAI API invocation failed: ${error.message}`,
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

    try {
      const response = await client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptText },
        ],
        response_format: toOpenAiResponseFormat(AI_SCHEMAS.evaluation.zod, 'EvaluatedAnswer'),
        temperature: 0.2,
      });

      const latencyMs = Date.now() - startTime;
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI returned empty evaluation message content');
      }

      const parsed = JSON.parse(content);
      const validated = EvaluatedAnswerAiSchema.parse(parsed);

      const promptTokens = response.usage?.prompt_tokens || 300;
      const completionTokens = response.usage?.completion_tokens || 150;
      const totalTokens = response.usage?.total_tokens || promptTokens + completionTokens;

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
      this.logger.error(`OpenAI evaluateAnswer failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AI_EVALUATION_FAILED,
        `OpenAI API evaluation failed: ${error.message}`,
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

    try {
      const response = await client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptText },
        ],
        response_format: toOpenAiResponseFormat(
          AI_SCHEMAS.learningPath.zod,
          'GeneratedLearningPath',
        ),
        temperature: 0.5,
      });

      const latencyMs = Date.now() - startTime;
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI returned empty learning path content');
      }

      const parsed = JSON.parse(content);
      const validated = GeneratedLearningPathAiSchema.parse(parsed);

      const promptTokens = response.usage?.prompt_tokens || 400;
      const completionTokens = response.usage?.completion_tokens || 250;
      const totalTokens = response.usage?.total_tokens || promptTokens + completionTokens;

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
      this.logger.error(`OpenAI generateLearningPath failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AI_GENERATION_FAILED,
        `OpenAI API learning path generation failed: ${error.message}`,
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
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
      ];

      for (const msg of context.chatHistory || []) {
        const role = msg.role === 'AI_TUTOR' || msg.role === 'assistant' ? 'assistant' : 'user';
        messages.push({ role, content: msg.content });
      }
      messages.push({ role: 'user', content: context.userMessage });

      let fullText = '';
      const stream = await client.chat.completions.create({
        model: this.defaultModel,
        messages,
        stream: true,
        temperature: 0.6,
        max_tokens: 800,
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) {
          fullText += token;
          onToken?.(token);
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
      this.logger.error(`OpenAI streamSocraticChat failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AI_GENERATION_FAILED,
        `OpenAI API socratic chat failed: ${error.message}`,
        error.status || 500,
      );
    }
  }
}
