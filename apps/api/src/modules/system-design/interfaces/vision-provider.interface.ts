import { VisualAnnotationDto } from '@ai-interview/contracts';

export interface VisionEvaluationOptions {
  imageBase64: string;
  canvasData?: unknown;
  problemTitle?: string;
  requirements?: string[];
  language?: 'vi' | 'en';
}

export interface VisionEvaluationResult {
  usageTokens?: number;
  overallScore: number;
  requirementsScore: number;
  highLevelScore: number;
  componentDetailScore: number;
  scalabilityScore: number;
  dataModelScore: number;
  summary: string;
  feedback: string;
  detectedComponents: string[];
  strengths: string[];
  bottlenecks: string[];
  recommendations: string[];
  annotations: VisualAnnotationDto[];
}

export interface VisionProvider {
  readonly name: string;
  evaluateDiagram(options: VisionEvaluationOptions): Promise<VisionEvaluationResult>;
}
