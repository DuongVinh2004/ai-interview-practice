import { z } from 'zod';
import { CompetencyArea } from '../enums';

export const CompetencyScoreDtoSchema = z.object({
  competency: z.nativeEnum(CompetencyArea),
  name: z.string(),
  score: z.number().min(0).max(10),
  sampleCount: z.number().int().min(0),
  benchmarkLevel: z.string(),
  description: z.string(),
});

export type CompetencyScoreDto = z.infer<typeof CompetencyScoreDtoSchema>;

export const CompetencyRadarResponseSchema = z.object({
  userId: z.string().uuid(),
  totalEvaluatedTurns: z.number().int().min(0),
  overallAverageScore: z.number().min(0).max(10),
  competencies: z.array(CompetencyScoreDtoSchema),
  topStrengths: z.array(z.string()),
  growthAreas: z.array(z.string()),
  updatedAt: z.string(),
});

export type CompetencyRadarResponse = z.infer<typeof CompetencyRadarResponseSchema>;

export const ProgressSessionPointSchema = z.object({
  sessionId: z.string().uuid(),
  completedAt: z.string(),
  jobRoleName: z.string(),
  seniorityLevelName: z.string(),
  overallScore: z.number(),
  targetDifficulty: z.number(),
  turnsCount: z.number(),
});

export type ProgressSessionPoint = z.infer<typeof ProgressSessionPointSchema>;

export const LongitudinalProgressResponseSchema = z.object({
  userId: z.string().uuid(),
  totalCompletedSessions: z.number().int().min(0),
  averageScore: z.number().min(0).max(10),
  highestScore: z.number().min(0).max(10),
  scoreVelocity: z.number(), // positive or negative improvement trend
  sessions: z.array(ProgressSessionPointSchema),
});

export type LongitudinalProgressResponse = z.infer<typeof LongitudinalProgressResponseSchema>;
