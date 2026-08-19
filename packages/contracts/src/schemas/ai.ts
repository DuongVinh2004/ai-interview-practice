import { z } from 'zod';
import { DifficultyLevel } from '../enums';

export const GeneratedQuestionAiSchema = z.object({
  content: z.string().min(10, 'Question content must be at least 10 characters'),
  keyFocus: z.string().min(3, 'Key focus area is required'),
  expectedKeyPoints: z.array(z.string()).min(1, 'At least one expected key point must be provided'),
  suggestedDifficulty: z.nativeEnum(DifficultyLevel).optional(),
});

export type GeneratedQuestionAi = z.infer<typeof GeneratedQuestionAiSchema>;

export const EvaluatedAnswerAiSchema = z.object({
  score: z.number().min(0).max(10),
  rubricScores: z.object({
    technicalAccuracy: z.number().min(0).max(10),
    depth: z.number().min(0).max(10),
    clarity: z.number().min(0).max(10),
  }),
  strengths: z.array(z.string()).min(1, 'At least one strength should be highlighted'),
  improvements: z.array(z.string()).min(1, 'At least one improvement suggestion is required'),
  conciseFeedback: z.string().min(5, 'Concise feedback is required'),
  evidence: z.array(z.string()).default([]),
});

export type EvaluatedAnswerAi = z.infer<typeof EvaluatedAnswerAiSchema>;

export const GeneratedLearningPathAiSchema = z.object({
  summary: z.string().min(10, 'Summary is required'),
  items: z
    .array(
      z.object({
        gap: z.string().min(3),
        topic: z.string().min(3),
        priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
        recommendedAction: z.string().min(10),
        searchKeywords: z.array(z.string()).min(1),
      }),
    )
    .min(1, 'At least one learning item is required'),
});

export type GeneratedLearningPathAi = z.infer<typeof GeneratedLearningPathAiSchema>;
