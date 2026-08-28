import { z } from 'zod';
import { SessionMode, CompetencyArea } from '../enums';
import { JobRoleDtoSchema, SeniorityLevelDtoSchema, TechnologyDtoSchema } from './taxonomy';

export const ConfigurationSourceSchema = z.enum(['MANUAL', 'PRESET', 'RECENT', 'BLUEPRINT']);
export type ConfigurationSource = z.infer<typeof ConfigurationSourceSchema>;

export const InterviewConfigurationDtoSchema = z.object({
  jobRoleId: z.string().uuid('Job role ID must be a valid UUID'),
  seniorityLevelId: z.string().uuid('Seniority level ID must be a valid UUID'),
  technologyIds: z
    .array(z.string().uuid('Technology ID must be a valid UUID'))
    .min(1, 'Select at least one technology')
    .max(5, 'You can select up to 5 technologies'),
  sessionMode: z.nativeEnum(SessionMode).default(SessionMode.STANDARD),
  competencyArea: z.nativeEnum(CompetencyArea).nullable().optional(),
  language: z.string().default('vi').optional(),
  totalTurns: z.number().int().min(1).max(5).default(5),
  isSandbox: z.boolean().default(false),
  blueprintId: z.string().uuid().nullable().optional(),
});

export type InterviewConfigurationDto = z.infer<typeof InterviewConfigurationDtoSchema>;

export const InterviewConfigurationPresetDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(255).nullable().optional(),
  jobRoleId: z.string().uuid(),
  seniorityLevelId: z.string().uuid(),
  technologyIds: z.array(z.string().uuid()),
  sessionMode: z.nativeEnum(SessionMode),
  competencyArea: z.nativeEnum(CompetencyArea).nullable().optional(),
  language: z.string(),
  totalTurns: z.number().int(),
  isSandbox: z.boolean(),
  blueprintId: z.string().uuid().nullable().optional(),
  isPinned: z.boolean(),
  useCount: z.number().int(),
  lastUsedAt: z.string().nullable().optional(),
  fingerprint: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  jobRole: JobRoleDtoSchema.optional(),
  seniorityLevel: SeniorityLevelDtoSchema.optional(),
  technologies: z.array(TechnologyDtoSchema).optional(),
  isCompatible: z.boolean().optional(),
  incompatibilityReasons: z.array(z.string()).optional(),
});

export type InterviewConfigurationPresetDto = z.infer<typeof InterviewConfigurationPresetDtoSchema>;

export const RecentInterviewConfigurationDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fingerprint: z.string(),
  jobRoleId: z.string().uuid(),
  seniorityLevelId: z.string().uuid(),
  technologyIds: z.array(z.string().uuid()),
  sessionMode: z.nativeEnum(SessionMode),
  competencyArea: z.nativeEnum(CompetencyArea).nullable().optional(),
  language: z.string(),
  totalTurns: z.number().int(),
  isSandbox: z.boolean(),
  blueprintId: z.string().uuid().nullable().optional(),
  useCount: z.number().int(),
  lastUsedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  jobRole: JobRoleDtoSchema.optional(),
  seniorityLevel: SeniorityLevelDtoSchema.optional(),
  technologies: z.array(TechnologyDtoSchema).optional(),
  isCompatible: z.boolean().optional(),
  incompatibilityReasons: z.array(z.string()).optional(),
});

export type RecentInterviewConfigurationDto = z.infer<typeof RecentInterviewConfigurationDtoSchema>;

export const CreatePresetRequestDtoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Preset name is required')
    .max(100, 'Preset name cannot exceed 100 characters'),
  description: z.string().trim().max(255, 'Description cannot exceed 255 characters').optional(),
  isPinned: z.boolean().default(false).optional(),
  config: InterviewConfigurationDtoSchema,
});

export type CreatePresetRequestDto = z.infer<typeof CreatePresetRequestDtoSchema>;

export const UpdatePresetRequestDtoSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(255).nullable().optional(),
  isPinned: z.boolean().optional(),
  config: InterviewConfigurationDtoSchema.optional(),
});

export type UpdatePresetRequestDto = z.infer<typeof UpdatePresetRequestDtoSchema>;

export const ValidateConfigurationRequestDtoSchema = z.object({
  presetId: z.string().uuid().optional(),
  config: InterviewConfigurationDtoSchema.optional(),
});

export type ValidateConfigurationRequestDto = z.infer<typeof ValidateConfigurationRequestDtoSchema>;

export const ValidationIssueSchema = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string(),
});

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ValidationResultDtoSchema = z.object({
  isValid: z.boolean(),
  fingerprint: z.string(),
  issues: z.array(ValidationIssueSchema),
  resolvedTaxonomy: z
    .object({
      jobRole: JobRoleDtoSchema.nullable().optional(),
      seniorityLevel: SeniorityLevelDtoSchema.nullable().optional(),
      technologies: z.array(TechnologyDtoSchema).optional(),
    })
    .optional(),
});

export type ValidationResultDto = z.infer<typeof ValidationResultDtoSchema>;
