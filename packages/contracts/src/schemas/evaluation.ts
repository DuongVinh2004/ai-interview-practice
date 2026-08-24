import { z } from 'zod';

export const RubricScoreSchema = z.object({
  technicalAccuracy: z.number().min(0).max(10),
  depth: z.number().min(0).max(10),
  clarity: z.number().min(0).max(10),
});

export type RubricScore = z.infer<typeof RubricScoreSchema>;

export const EvaluationDtoSchema = z.object({
  id: z.string().uuid(),
  answerId: z.string().uuid(),
  score: z.number().min(0).max(10),
  rubricScores: RubricScoreSchema,
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  conciseFeedback: z.string(),
  evidence: z.array(z.string()),
  confidence: z.number().min(0).max(1).default(0.85),
  missingConcepts: z.array(z.string()).default([]),
  needsReview: z.boolean().default(false),
  safetyFlags: z.array(z.string()).optional(),
  createdAt: z.string(),
});

export type EvaluationDto = z.infer<typeof EvaluationDtoSchema>;
