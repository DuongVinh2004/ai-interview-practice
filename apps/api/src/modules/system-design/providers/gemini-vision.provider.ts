import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  VisionProvider,
  VisionEvaluationOptions,
  VisionEvaluationResult,
} from '../interfaces/vision-provider.interface';

@Injectable()
export class GeminiVisionProvider implements VisionProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiVisionProvider.name);
  private client: GoogleGenerativeAI | null = null;
  private readonly modelName: string;

  constructor(private readonly configService: ConfigService) {
    const configKey =
      this.configService.get<string>('vision.geminiApiKey') ??
      this.configService.get<string>('ai.geminiApiKey');
    const apiKey = configKey !== undefined ? configKey : process.env.GEMINI_API_KEY || '';
    this.modelName =
      this.configService.get<string>('vision.geminiVisionModel') || 'gemini-1.5-flash';

    if (apiKey && !apiKey.includes('mock') && apiKey.trim().length > 0) {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  async evaluateDiagram(options: VisionEvaluationOptions): Promise<VisionEvaluationResult> {
    if (!this.client) {
      throw new Error('Gemini Vision Client is not configured with a valid API Key');
    }

    this.logger.log(`Evaluating whiteboard architecture diagram with Gemini ${this.modelName}`);

    const isVi = options.language === 'vi';
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const rawImage = (options.imageUrl || options.imageBase64 || '').trim();
    let cleanBase64 = rawImage;
    if (rawImage.includes('base64,')) {
      cleanBase64 = rawImage.split('base64,')[1];
    } else if (rawImage.startsWith('http://') || rawImage.startsWith('https://')) {
      try {
        const fetchRes = await fetch(rawImage);
        const arrayBuf = await fetchRes.arrayBuffer();
        cleanBase64 = Buffer.from(arrayBuf).toString('base64');
      } catch (err) {
        this.logger.warn(`Failed to fetch image from URL: ${err}`);
      }
    }

    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType: 'image/png',
      },
    };

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

Output strict JSON:
{
  "overallScore": number (0-10),
  "requirementsScore": number (0-10),
  "highLevelScore": number (0-10),
  "componentDetailScore": number (0-10),
  "scalabilityScore": number (0-10),
  "dataModelScore": number (0-10),
  "summary": string (in ${isVi ? 'Vietnamese' : 'English'}),
  "feedback": string (in ${isVi ? 'Vietnamese' : 'English'}),
  "detectedComponents": string[],
  "strengths": string[],
  "bottlenecks": string[],
  "recommendations": string[],
  "annotations": [
    {
      "x": number (0-100),
      "y": number (0-100),
      "width": number (0-100),
      "height": number (0-100),
      "label": string,
      "severity": "critical" | "warning" | "suggestion" | "good",
      "suggestion": string
    }
  ]
}`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();
    const cleanJson = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const parsed = JSON.parse(cleanJson);

    return {
      usageTokens: response.usageMetadata?.totalTokenCount,
      overallScore: Number(parsed.overallScore) || 8.2,
      requirementsScore: Number(parsed.requirementsScore) || 8.0,
      highLevelScore: Number(parsed.highLevelScore) || 8.5,
      componentDetailScore: Number(parsed.componentDetailScore) || 8.0,
      scalabilityScore: Number(parsed.scalabilityScore) || 8.5,
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
