import { z } from 'zod';
import { BehavioralCategory } from '../enums';

export const BehavioralCompetencySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  nameVi: z.string(),
  description: z.string().nullable().optional(),
  category: z.nativeEnum(BehavioralCategory),
  isActive: z.boolean(),
  order: z.number().int(),
});
export type BehavioralCompetencyDto = z.infer<typeof BehavioralCompetencySchema>;

export const BehavioralCompanyPresetSchema = z.enum([
  'GENERAL',
  'AMAZON_LEADERSHIP',
  'GOOGLE_GOOGLINESS',
  'META_VALUES',
]);
export type BehavioralCompanyPreset = z.infer<typeof BehavioralCompanyPresetSchema>;

export const AnalyzeStarRequestSchema = z.object({
  sessionId: z.string().uuid(),
  turnNumber: z.number().int().min(1),
  questionText: z.string(),
  candidateAnswer: z.string().min(5),
  competencyArea: z.string().optional(),
});
export type AnalyzeStarRequest = z.infer<typeof AnalyzeStarRequestSchema>;

export const StarComponentsDetectedSchema = z.object({
  situation: z.boolean(),
  task: z.boolean(),
  action: z.boolean(),
  result: z.boolean(),
});
export type StarComponentsDetected = z.infer<typeof StarComponentsDetectedSchema>;

export const AnalyzeStarResponseSchema = z.object({
  starIdentified: StarComponentsDetectedSchema,
  actionNeeded: z.enum(['PROBE', 'COMPLETE']),
  missingComponents: z.array(z.enum(['situation', 'task', 'action', 'result'])),
  probeText: z.string().nullable().optional(),
  probeTextVi: z.string().nullable().optional(),
  annotatedSegments: z
    .object({
      situation: z.string().nullable().optional(),
      task: z.string().nullable().optional(),
      action: z.string().nullable().optional(),
      result: z.string().nullable().optional(),
    })
    .optional(),
});
export type AnalyzeStarResponse = z.infer<typeof AnalyzeStarResponseSchema>;

export const StarRubricScoresSchema = z.object({
  situationScore: z.number().min(0).max(4),
  taskScore: z.number().min(0).max(4),
  actionScore: z.number().min(0).max(4),
  resultScore: z.number().min(0).max(4),
  structureScore: z.number().min(0).max(2),
  totalScore: z.number().min(0).max(10), // Normalized out of 10
});
export type StarRubricScores = z.infer<typeof StarRubricScoresSchema>;

export const StarEvaluationReportSchema = z.object({
  id: z.string().uuid(),
  answerId: z.string().uuid(),
  situationText: z.string().nullable().optional(),
  taskText: z.string().nullable().optional(),
  actionText: z.string().nullable().optional(),
  resultText: z.string().nullable().optional(),
  scores: StarRubricScoresSchema,
  conciseFeedback: z.string(),
  probingQuestionsAsked: z.array(z.string()).default([]),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  createdAt: z.string().datetime(),
});
export type StarEvaluationReport = z.infer<typeof StarEvaluationReportSchema>;
