import { z } from 'zod';
import { CompetencyArea } from '../enums';

export interface ISkillNode {
  id: string;
  parentId?: string | null;
  competencyArea?: CompetencyArea | null;
  slug: string;
  name: string;
  nameVi?: string | null;
  description?: string | null;
  level: number;
  weight: number;
  isActive: boolean;
  order: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  children?: ISkillNode[];
}

export const SkillNodeSchema: z.ZodType<ISkillNode, z.ZodTypeDef, any> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    parentId: z.string().uuid().nullable().optional(),
    competencyArea: z.nativeEnum(CompetencyArea).nullable().optional(),
    slug: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    nameVi: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    level: z.number().int().min(1).max(3).default(1),
    weight: z.number().min(0).max(10).default(1.0),
    isActive: z.boolean().default(true),
    order: z.number().int().default(0),
    createdAt: z.string().or(z.date()),
    updatedAt: z.string().or(z.date()),
    children: z.array(SkillNodeSchema).optional(),
  }),
);

export type SkillNodeDto = ISkillNode;

export const SkillScoreSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  skillNodeId: z.string().uuid(),
  rawScore: z.number().min(0).max(10),
  weightedScore: z.number().min(0).max(10),
  evidenceCount: z.number().int().min(0),
  lastEvaluatedAt: z.string().or(z.date()),
  rubricVersion: z.string(),
  calculatedAt: z.string().or(z.date()),
  skillNode: SkillNodeSchema.optional(),
});

export type SkillScoreDto = z.infer<typeof SkillScoreSchema>;

export const BenchmarkSnapshotSchema = z.object({
  id: z.string().uuid(),
  skillNodeId: z.string().uuid(),
  jobRoleSlug: z.string().nullable().optional(),
  senioritySlug: z.string().nullable().optional(),
  cohortSize: z.number().int(),
  p25: z.number(),
  p50: z.number(),
  p75: z.number(),
  p90: z.number(),
  mean: z.number(),
  stdDev: z.number(),
  calculatedAt: z.string().or(z.date()),
});

export type BenchmarkSnapshotDto = z.infer<typeof BenchmarkSnapshotSchema>;

export interface ISkillGraphNodeDto {
  id: string;
  name: string;
  nameVi?: string | null;
  slug: string;
  level: number;
  competencyArea?: CompetencyArea | null;
  score: number;
  rawScore: number;
  evidenceCount: number;
  benchmarkP50?: number | null;
  percentile?: number | null;
  children?: ISkillGraphNodeDto[];
}

export const SkillGraphNodeDtoSchema: z.ZodType<ISkillGraphNodeDto, z.ZodTypeDef, any> = z.lazy(
  () =>
    z.object({
      id: z.string(),
      name: z.string(),
      nameVi: z.string().optional().nullable(),
      slug: z.string(),
      level: z.number(),
      competencyArea: z.nativeEnum(CompetencyArea).optional().nullable(),
      score: z.number(),
      rawScore: z.number(),
      evidenceCount: z.number(),
      benchmarkP50: z.number().optional().nullable(),
      percentile: z.number().optional().nullable(),
      children: z.array(SkillGraphNodeDtoSchema).optional(),
    }),
);

export type SkillGraphNodeDto = ISkillGraphNodeDto;

export const SkillGraphResponseSchema = z.object({
  userId: z.string(),
  overallScore: z.number(),
  areas: z.array(
    z.object({
      area: z.nativeEnum(CompetencyArea),
      name: z.string(),
      score: z.number(),
      benchmarkP50: z.number(),
      percentile: z.number().optional().nullable(),
      subCompetencies: z.array(SkillGraphNodeDtoSchema),
    }),
  ),
  lastUpdated: z.string().or(z.date()),
});

export type SkillGraphResponseDto = z.infer<typeof SkillGraphResponseSchema>;

export const BenchmarkRankingSchema = z.object({
  jobRoleSlug: z.string(),
  senioritySlug: z.string(),
  cohortSize: z.number(),
  percentileRank: z.number(), // 0 - 100
  meanScore: z.number(),
  userScore: z.number(),
  competencyRankings: z.array(
    z.object({
      area: z.nativeEnum(CompetencyArea),
      userScore: z.number(),
      p25: z.number(),
      p50: z.number(),
      p75: z.number(),
      p90: z.number(),
      percentile: z.number(),
    }),
  ),
});

export type BenchmarkRankingDto = z.infer<typeof BenchmarkRankingSchema>;

export const ProgressTrendPointSchema = z.object({
  date: z.string(),
  overallScore: z.number(),
  areaScores: z.record(z.nativeEnum(CompetencyArea), z.number()),
});

export type ProgressTrendPointDto = z.infer<typeof ProgressTrendPointSchema>;

export const SkillProgressTrendSchema = z.object({
  period: z.enum(['7d', '30d', '90d', '180d', '365d']),
  trends: z.array(ProgressTrendPointSchema),
  overallDelta: z.number(),
});

export type SkillProgressTrendDto = z.infer<typeof SkillProgressTrendSchema>;

export const GapAnalysisItemSchema = z.object({
  skillNodeId: z.string(),
  name: z.string(),
  competencyArea: z.nativeEnum(CompetencyArea),
  currentScore: z.number(),
  targetScore: z.number(),
  gapScore: z.number(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  recommendation: z.string(),
  suggestedAction: z.string(),
});

export type GapAnalysisItemDto = z.infer<typeof GapAnalysisItemSchema>;

export const GapAnalysisResponseSchema = z.object({
  roleTitle: z.string(),
  seniorityLevel: z.string(),
  topGaps: z.array(GapAnalysisItemSchema),
});

export type GapAnalysisResponseDto = z.infer<typeof GapAnalysisResponseSchema>;
