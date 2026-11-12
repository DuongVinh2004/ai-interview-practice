import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  VisionProvider,
  VisionEvaluationOptions,
  VisionEvaluationResult,
} from '../interfaces/vision-provider.interface';

@Injectable()
export class OpenAiVisionProvider implements VisionProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAiVisionProvider.name);
  private client: OpenAI | null = null;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const configKey =
      this.configService.get<string>('vision.openaiApiKey') ??
      this.configService.get<string>('ai.openaiApiKey');
    const apiKey = configKey !== undefined ? configKey : process.env.OPENAI_API_KEY || '';
    const baseURL =
      this.configService.get<string>('vision.openaiBaseUrl') ||
      this.configService.get<string>('ai.openaiBaseUrl') ||
      process.env.OPENAI_BASE_URL;
    this.model = this.configService.get<string>('vision.openaiVisionModel') || 'gpt-4o';

    if (apiKey && !apiKey.includes('mock') && apiKey.trim().length > 0) {
      this.client = new OpenAI({
        apiKey,
        ...(baseURL ? { baseURL } : {}),
        timeout: 35000,
      });
    }
  }

  async evaluateDiagram(options: VisionEvaluationOptions): Promise<VisionEvaluationResult> {
    if (!this.client) {
      throw new Error('OpenAI Vision Client is not configured with a valid API Key');
    }

    this.logger.log(`Evaluating whiteboard architecture diagram with OpenAI ${this.model}`);

    const isVi = options.language === 'vi';
    const prompt = `You are a Principal System Architect conducting a high-stakes technical interview.
Analyze this system design whiteboard canvas snapshot diagram.
Problem Title: "${options.problemTitle || 'Scalable Distributed System'}"
Functional Requirements: ${options.requirements?.join(', ') || 'High throughput, low latency, 99.99% availability'}

Evaluate the architecture along 5 core dimensions:
1. Requirements & Scope (0-10)
2. High-Level Architecture & Component Boundaries (0-10)
3. Component Detail & Data Flow (0-10)
4. Scalability & Resilience (0-10)
5. Data Modeling & Storage Strategy (0-10)

Provide structured JSON response with:
- overallScore (number 0-10)
- requirementsScore (number 0-10)
- highLevelScore (number 0-10)
- componentDetailScore (number 0-10)
- scalabilityScore (number 0-10)
- dataModelScore (number 0-10)
- summary (string in ${isVi ? 'Vietnamese' : 'English'})
- feedback (detailed critique in ${isVi ? 'Vietnamese' : 'English'})
- detectedComponents (array of component names detected in image)
- strengths (array of 3-4 strengths in ${isVi ? 'Vietnamese' : 'English'})
- bottlenecks (array of 2-3 single points of failure / bottlenecks in ${isVi ? 'Vietnamese' : 'English'})
- recommendations (array of 2-3 follow-up recommendations in ${isVi ? 'Vietnamese' : 'English'})
- annotations: array of visual bounding boxes locating diagram issues:
  [{ x: number (percentage 0-100), y: number (percentage 0-100), width: number, height: number, label: string, severity: "critical" | "warning" | "suggestion" | "good", suggestion: string }]
`;

    const rawImage = (options.imageUrl || options.imageBase64 || '').trim();
    let formattedImageUrl: string;
    if (
      rawImage.startsWith('data:') ||
      rawImage.startsWith('http://') ||
      rawImage.startsWith('https://')
    ) {
      formattedImageUrl = rawImage;
    } else if (rawImage.startsWith('s3://')) {
      const withoutScheme = rawImage.replace(/^s3:\/\//, '');
      const slashIndex = withoutScheme.indexOf('/');
      if (slashIndex !== -1) {
        const bucket = withoutScheme.substring(0, slashIndex);
        const key = withoutScheme.substring(slashIndex + 1);
        formattedImageUrl = `https://${bucket}.s3.amazonaws.com/${key}`;
      } else {
        formattedImageUrl = `https://s3.amazonaws.com/${withoutScheme}`;
      }
    } else {
      formattedImageUrl = `data:image/png;base64,${rawImage}`;
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: formattedImageUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content || '{}';
    const cleanJson = content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      this.logger.warn('Failed to parse OpenAI Vision response as JSON, falling back to defaults');
      parsed = {};
    }

    const parseScore = (val: any, fallback = 8.0): number => {
      const num = Number(val);
      return Number.isFinite(num) && num >= 0 && num <= 10 ? num : fallback;
    };

    const overallScore = parseScore(parsed.overallScore, 8.0);
    const requirementsScore = parseScore(parsed.requirementsScore, overallScore);
    const highLevelScore = parseScore(parsed.highLevelScore, overallScore);
    const componentDetailScore = parseScore(parsed.componentDetailScore, overallScore);
    const scalabilityScore = parseScore(parsed.scalabilityScore, overallScore);
    const dataModelScore = parseScore(parsed.dataModelScore, overallScore);

    const annotations = Array.isArray(parsed.annotations)
      ? parsed.annotations.map((a: any) => ({
          x: Number(a.x) || 0,
          y: Number(a.y) || 0,
          width: Number(a.width) || 10,
          height: Number(a.height) || 10,
          label: String(a.label || 'Architecture Note'),
          severity: ['critical', 'warning', 'suggestion', 'good', 'info', 'error'].includes(
            a.severity,
          )
            ? a.severity
            : 'suggestion',
          suggestion: a.suggestion || a.comment || '',
          comment: a.comment || a.suggestion || '',
          componentName: a.componentName || a.label || undefined,
        }))
      : [];

    return {
      usageTokens: response.usage?.total_tokens,
      overallScore,
      requirementsScore,
      highLevelScore,
      componentDetailScore,
      scalabilityScore,
      dataModelScore,
      summary: parsed.summary || 'Architecture diagram evaluated.',
      feedback: parsed.feedback || '',
      detectedComponents: Array.isArray(parsed.detectedComponents) ? parsed.detectedComponents : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      bottlenecks: Array.isArray(parsed.bottlenecks) ? parsed.bottlenecks : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      annotations,
    };
  }
}
