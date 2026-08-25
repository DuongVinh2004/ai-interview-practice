import { z } from 'zod';
import { TenantRole, AssignmentStatus, CompetencyArea, SessionMode } from '../enums';

export const TenantBrandingSchema = z.object({
  logoUrl: z.string().url().optional().or(z.literal('')),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Hex color code required')
    .default('#059669'),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Hex color code required')
    .default('#10b981'),
  companyName: z.string().optional(),
});

export type TenantBrandingDto = z.infer<typeof TenantBrandingSchema>;

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(200),
  domain: z.string().max(200).nullable().optional(),
  slug: z.string().min(2).max(50),
  brandingConfig: TenantBrandingSchema.nullable().optional(),
  subscriptionId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
  memberCount: z.number().int().optional(),
  cohortCount: z.number().int().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type TenantDto = z.infer<typeof TenantSchema>;

export const CreateTenantSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  domain: z.string().max(200).optional(),
  brandingConfig: TenantBrandingSchema.optional(),
});

export type CreateTenantDto = z.infer<typeof CreateTenantSchema>;

export const UpdateBrandingSchema = z.object({
  brandingConfig: TenantBrandingSchema,
});

export type UpdateBrandingDto = z.infer<typeof UpdateBrandingSchema>;

export const TenantMemberSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email().optional(),
  fullName: z.string().optional(),
  role: z.nativeEnum(TenantRole),
  joinedAt: z.string().or(z.date()),
});

export type TenantMemberDto = z.infer<typeof TenantMemberSchema>;

export const AddTenantMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(TenantRole).default(TenantRole.STUDENT),
});

export type AddTenantMemberDto = z.infer<typeof AddTenantMemberSchema>;

export const CohortSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(2).max(200),
  description: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  memberCount: z.number().int().default(0),
  assignmentCount: z.number().int().default(0),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type CohortDto = z.infer<typeof CohortSchema>;

export const CreateCohortSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
});

export type CreateCohortDto = z.infer<typeof CreateCohortSchema>;

export const RosterMemberSchema = z.object({
  email: z.string().email(),
  fullName: z.string().optional(),
  role: z.nativeEnum(TenantRole).default(TenantRole.STUDENT),
});

export type RosterMemberDto = z.infer<typeof RosterMemberSchema>;

export const ImportRosterSchema = z.object({
  csvContent: z.string().min(1, 'CSV content is required'),
});

export type ImportRosterDto = z.infer<typeof ImportRosterSchema>;

export const ImportRosterResultSchema = z.object({
  totalImported: z.number().int(),
  successCount: z.number().int(),
  skippedCount: z.number().int(),
  errors: z.array(z.string()),
});

export type ImportRosterResultDto = z.infer<typeof ImportRosterResultSchema>;

export const AssignmentConfigSchema = z.object({
  sessionMode: z.nativeEnum(SessionMode).default(SessionMode.STANDARD),
  difficulty: z.number().int().min(1).max(3).default(2),
  targetScore: z.number().min(0).max(10).default(7.0),
  rubricId: z.string().optional(),
  questionBankId: z.string().optional(),
});

export type AssignmentConfigDto = z.infer<typeof AssignmentConfigSchema>;

export const AssignmentSchema = z.object({
  id: z.string().uuid(),
  cohortId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(AssignmentStatus),
  deadline: z.string().or(z.date()).nullable().optional(),
  config: AssignmentConfigSchema,
  totalCandidates: z.number().int().default(0),
  completedCandidates: z.number().int().default(0),
  averageScore: z.number().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type AssignmentDto = z.infer<typeof AssignmentSchema>;

export const CreateAssignmentSchema = z.object({
  cohortId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  deadline: z.string().or(z.date()).optional(),
  config: AssignmentConfigSchema.default({
    sessionMode: SessionMode.STANDARD,
    difficulty: 2,
    targetScore: 7.0,
  }),
});

export type CreateAssignmentDto = z.infer<typeof CreateAssignmentSchema>;

export const PublishAssignmentSchema = z.object({
  status: z.nativeEnum(AssignmentStatus),
});

export type PublishAssignmentDto = z.infer<typeof PublishAssignmentSchema>;

export const SkillHeatmapItemSchema = z.object({
  competencyArea: z.nativeEnum(CompetencyArea),
  areaName: z.string(),
  averageScore: z.number(),
  passingRate: z.number(), // % of students above threshold
  weakestTopic: z.string().optional(),
  strongestTopic: z.string().optional(),
});

export type SkillHeatmapItemDto = z.infer<typeof SkillHeatmapItemSchema>;

export const StudentProgressSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string(),
  email: z.string(),
  completedAssignments: z.number().int(),
  totalAssignments: z.number().int(),
  averageScore: z.number(),
  readinessScore: z.number().optional(),
  needsAssistance: z.boolean(),
  lastActiveAt: z.string().or(z.date()).nullable().optional(),
});

export type StudentProgressDto = z.infer<typeof StudentProgressSchema>;

export const CohortAnalyticsSchema = z.object({
  cohortId: z.string().uuid(),
  cohortName: z.string(),
  totalStudents: z.number().int(),
  activeStudents: z.number().int(),
  overallAverageScore: z.number(),
  completionRate: z.number(), // 0 - 100
  scoreDistribution: z.object({
    bracket0to4: z.number().int(),
    bracket4to6: z.number().int(),
    bracket6to8: z.number().int(),
    bracket8to10: z.number().int(),
  }),
  skillHeatmap: z.array(SkillHeatmapItemSchema),
  studentsNeedingHelp: z.array(StudentProgressSchema),
  topPerformers: z.array(StudentProgressSchema),
});

export type CohortAnalyticsDto = z.infer<typeof CohortAnalyticsSchema>;

export const TenantApiKeySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  lastUsed: z.string().or(z.date()).nullable().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().or(z.date()),
});

export type TenantApiKeyDto = z.infer<typeof TenantApiKeySchema>;

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
});

export type CreateApiKeyDto = z.infer<typeof CreateApiKeySchema>;

export const ApiKeyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  apiKey: z.string(), // Plain text key displayed only once on creation
  createdAt: z.string().or(z.date()),
});

export type ApiKeyResponseDto = z.infer<typeof ApiKeyResponseSchema>;
