import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
import { toGeminiResponseSchema, AI_SCHEMAS } from '../utils/zod-to-json-schema.util';

@Injectable()
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private client: GoogleGenerativeAI | null = null;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ai.geminiApiKey', '');
    this.defaultModel = this.configService.get<string>('ai.geminiModel', 'gemini-3.6-flash');
    this.timeoutMs = this.configService.get<number>('ai.timeoutMs', 10000);

    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  private getClient(): GoogleGenerativeAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('ai.geminiApiKey', '');
      if (!apiKey) {
        throw new DomainException(
          ErrorCode.AI_GENERATION_FAILED,
          'Gemini API key is not configured.',
          401,
        );
      }
      this.client = new GoogleGenerativeAI(apiKey);
    }
    return this.client;
  }

  private calculateCost(promptTokens: number, completionTokens: number): number {
    // Gemini 2.0 Flash pricing: $0.10 / 1M prompt tokens, $0.40 / 1M completion tokens
    const promptCost = (promptTokens / 1_000_000) * 0.1;
    const completionCost = (completionTokens / 1_000_000) * 0.4;
    return Number((promptCost + completionCost).toFixed(6));
  }

  async generateQuestion(
    context: QuestionPromptContext,
    systemPrompt: string,
    userPrompt?: string,
  ): Promise<AiExecutionResult<GeneratedQuestionAi>> {
    const startTime = Date.now();
    const client = this.getClient();
    const model = client.getGenerativeModel(
      {
        model: this.defaultModel,
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: toGeminiResponseSchema(AI_SCHEMAS.question.zod, 'GeneratedQuestion'),
          temperature: 0.7,
        },
      },
      { timeout: this.timeoutMs },
    );

    const promptText =
      userPrompt ||
      `Role: ${context.role}\nLevel: ${context.level}\nTechnologies: ${context.technologies.join(', ')}\nTurn: ${context.turnNumber}\nDifficulty: ${context.difficulty}`;

    try {
      const result = await model.generateContent(promptText);
      const latencyMs = Date.now() - startTime;
      const response = result.response;
      const text = response.text();

      const parsed = JSON.parse(text);
      const validated = GeneratedQuestionAiSchema.parse(parsed);

      const promptTokens = response.usageMetadata?.promptTokenCount || 200;
      const completionTokens = response.usageMetadata?.candidatesTokenCount || 100;
      const totalTokens =
        response.usageMetadata?.totalTokenCount || promptTokens + completionTokens;

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
      this.logger.error(`Gemini generateQuestion failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AI_GENERATION_FAILED,
        `Gemini API invocation failed: ${error.message}`,
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
    const model = client.getGenerativeModel(
      {
        model: this.defaultModel,
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: toGeminiResponseSchema(AI_SCHEMAS.evaluation.zod, 'EvaluatedAnswer'),
          temperature: 0.2, // low temperature for consistent evaluation
        },
      },
      { timeout: this.timeoutMs },
    );

    const promptText =
      userPrompt ||
      `Question: ${context.question}\nKey Focus: ${context.keyFocus || 'General'}\nCandidate Answer: ${context.answer}\nRole: ${context.role} (${context.level})`;

    try {
      const result = await model.generateContent(promptText);
      const latencyMs = Date.now() - startTime;
      const response = result.response;
      const text = response.text();

      const parsed = JSON.parse(text);
      const validated = EvaluatedAnswerAiSchema.parse(parsed);

      const promptTokens = response.usageMetadata?.promptTokenCount || 300;
      const completionTokens = response.usageMetadata?.candidatesTokenCount || 150;
      const totalTokens =
        response.usageMetadata?.totalTokenCount || promptTokens + completionTokens;

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
      this.logger.error(`Gemini evaluateAnswer failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AI_EVALUATION_FAILED,
        `Gemini API evaluation failed: ${error.message}`,
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
    const model = client.getGenerativeModel(
      {
        model: this.defaultModel,
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: toGeminiResponseSchema(
            AI_SCHEMAS.learningPath.zod,
            'GeneratedLearningPath',
          ),
          temperature: 0.5,
        },
      },
      { timeout: this.timeoutMs },
    );

    const promptText =
      userPrompt ||
      `Role: ${context.role} (${context.level})\nOverall Score: ${context.overallScore}/10\nTurns Count: ${context.turns.length}`;

    try {
      const result = await model.generateContent(promptText);
      const latencyMs = Date.now() - startTime;
      const response = result.response;
      const text = response.text();

      const parsed = JSON.parse(text);
      const validated = GeneratedLearningPathAiSchema.parse(parsed);

      const promptTokens = response.usageMetadata?.promptTokenCount || 400;
      const completionTokens = response.usageMetadata?.candidatesTokenCount || 250;
      const totalTokens =
        response.usageMetadata?.totalTokenCount || promptTokens + completionTokens;

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
      this.logger.error(`Gemini generateLearningPath failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AI_GENERATION_FAILED,
        `Gemini API learning path generation failed: ${error.message}`,
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
      const model = client.getGenerativeModel(
        {
          model: this.defaultModel,
          systemInstruction: systemPrompt,
        },
        { timeout: this.timeoutMs },
      );

      const history = (context.chatHistory || []).map(m => ({
        role: m.role === 'AI_TUTOR' || m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const chat = model.startChat({ history });
      const result = await chat.sendMessageStream(context.userMessage);

      let fullText = '';
      for await (const chunk of result.stream) {
        const token = chunk.text();
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

      const promptTokens = 200;
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
      this.logger.error(`Gemini streamSocraticChat failed: ${error.message}`);
      if (error instanceof DomainException) throw error;
      throw new DomainException(
        ErrorCode.AI_GENERATION_FAILED,
        `Gemini API socratic chat failed: ${error.message}`,
        error.status || 500,
      );
    }
  }
}
