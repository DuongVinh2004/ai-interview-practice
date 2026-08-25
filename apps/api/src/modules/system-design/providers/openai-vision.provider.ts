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
    const apiKey =
      this.configService.get<string>('vision.openaiApiKey') ||
      this.configService.get<string>('ai.openaiApiKey') ||
      process.env.OPENAI_API_KEY ||
      '';
    this.model =
      this.configService.get<string>('vision.openaiVisionModel') ||
      'gpt-4o';

    if (apiKey && !apiKey.includes('mock')) {
      this.client = new OpenAI({ apiKey, timeout: 35000 });
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
                url: options.imageBase64.startsWith('data:')
                  ? options.imageBase64
                  : `data:image/png;base64,${options.imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      overallScore: Number(parsed.overallScore) || 8.0,
      requirementsScore: Number(parsed.requirementsScore) || 8.0,
      highLevelScore: Number(parsed.highLevelScore) || 8.0,
      componentDetailScore: Number(parsed.componentDetailScore) || 8.0,
      scalabilityScore: Number(parsed.scalabilityScore) || 8.0,
      dataModelScore: Number(parsed.dataModelScore) || 8.0,
      summary: parsed.summary || 'Architecture diagram evaluated.',
      feedback: parsed.feedback || '',
      detectedComponents: parsed.detectedComponents || [],
      strengths: parsed.strengths || [],
      bottlenecks: parsed.bottlenecks || [],
      recommendations: parsed.recommendations || [],
      annotations: parsed.annotations || [],
    };
  }
}
