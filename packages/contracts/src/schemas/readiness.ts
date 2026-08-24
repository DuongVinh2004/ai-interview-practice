import { z } from 'zod';
import { CompetencyArea } from '../enums';

export const ReadinessWeightProfileSchema = z.object({
  id: z.string().uuid(),
  jobRoleSlug: z.string().min(1).max(50),
  competencyArea: z.nativeEnum(CompetencyArea),
  weight: z.number().min(0).max(1.0),
  isActive: z.boolean().default(true),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type ReadinessWeightProfileDto = z.infer<typeof ReadinessWeightProfileSchema>;

export const TierDefinitionSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  nameVi: z.string().min(1).max(100),
  minReadinessScore: z.number().min(0).max(100),
  minCompetencyScore: z.number().min(0).max(10),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type TierDefinitionDto = z.infer<typeof TierDefinitionSchema>;

export const ReadinessMilestoneSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  jobRoleSlug: z.string(),
  milestoneType: z.string(),
  achievedAt: z.string().or(z.date()),
  readinessScore: z.number(),
});

export type ReadinessMilestoneDto = z.infer<typeof ReadinessMilestoneSchema>;

export const ReadinessSnapshotSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  jobRoleSlug: z.string(),
  readinessScore: z.number().min(0).max(100),
  tierSlug: z.string(),
  confidenceLow: z.number().min(0).max(100),
  confidenceHigh: z.number().min(0).max(100),
  competencyScores: z.record(z.nativeEnum(CompetencyArea), z.number()),
  velocityData: z.record(z.nativeEnum(CompetencyArea), z.number()).optional().nullable(),
  evidenceCount: z.number().int().min(0),
  snapshotDate: z.string().or(z.date()),
});

export type ReadinessSnapshotDto = z.infer<typeof ReadinessSnapshotSchema>;

export const CompetencyBreakdownItemSchema = z.object({
  area: z.nativeEnum(CompetencyArea),
  name: z.string(),
  currentScore: z.number(), // 0 - 10
  targetScore: z.number(),  // 0 - 10
  weight: z.number(),       // 0 - 1.0
  fulfillmentPercentage: z.number(), // min(score/target, 1.0) * 100
  status: z.enum(['BELOW_TARGET', 'APPROACHING', 'TARGET_MET']),
  velocity: z.number(),     // points per week
  estimatedWeeksToTarget: z.number().nullable(),
});

export type CompetencyBreakdownItemDto = z.infer<typeof CompetencyBreakdownItemSchema>;

export const RoadmapActionItemSchema = z.object({
  priority: z.number().int(),
  area: z.nativeEnum(CompetencyArea),
  areaName: z.string(),
  impactScore: z.number(),
  gapScore: z.number(),
  actionTitle: z.string(),
  actionDescription: z.string(),
  recommendedMode: z.string(),
});

export type RoadmapActionItemDto = z.infer<typeof RoadmapActionItemSchema>;

export const ReadinessDashboardResponseSchema = z.object({
  userId: z.string(),
  jobRoleSlug: z.string(),
  jobRoleName: z.string(),
  readinessScore: z.number(), // 0 - 100
  tier: z.object({
    slug: z.string(),
    name: z.string(),
    nameVi: z.string(),
    badgeColor: z.string(),
  }),
  confidenceInterval: z.object({
    low: z.number(),
    high: z.number(),
    confidenceLevel: z.string().default('95%'),
    evidenceCount: z.number(),
  }),
  velocity: z.object({
    weeklyRate: z.number(),
    status: z.enum(['IMPROVING', 'STABLE', 'DECLINING', 'INSUFFICIENT_DATA']),
    weeksToNextTier: z.number().nullable(),
    estimatedTargetDate: z.string().nullable(),
  }),
  breakdown: z.array(CompetencyBreakdownItemSchema),
  milestones: z.array(
    z.object({
      type: z.string(),
      targetScore: z.number(),
      achieved: z.boolean(),
      achievedAt: z.string().nullable().optional(),
    })
  ),
  roadmap: z.array(RoadmapActionItemSchema),
  disclaimer: z.string(),
});

export type ReadinessDashboardResponseDto = z.infer<typeof ReadinessDashboardResponseSchema>;

export const ReadinessHistoryPointSchema = z.object({
  date: z.string(),
  score: z.number(),
  tierSlug: z.string(),
});

export type ReadinessHistoryPointDto = z.infer<typeof ReadinessHistoryPointSchema>;

export const ReadinessHistoryResponseSchema = z.object({
  period: z.enum(['30d', '90d', '180d', '365d']),
  history: z.array(ReadinessHistoryPointSchema),
  netChange: z.number(),
});

export type ReadinessHistoryResponseDto = z.infer<typeof ReadinessHistoryResponseSchema>;

export const ReadinessRoleCompareItemSchema = z.object({
  jobRoleSlug: z.string(),
  jobRoleName: z.string(),
  readinessScore: z.number(),
  tierSlug: z.string(),
  tierName: z.string(),
  estimatedWeeks: z.number().nullable(),
});

export type ReadinessRoleCompareItemDto = z.infer<typeof ReadinessRoleCompareItemSchema>;
