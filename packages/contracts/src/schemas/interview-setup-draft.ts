import { z } from 'zod';
import { InterviewConfigurationDtoSchema } from './interview-configuration';

export const FieldSourceTypeSchema = z.enum(['cv', 'jd', 'preset', 'manual', 'default']);
export type FieldSourceType = z.infer<typeof FieldSourceTypeSchema>;

export const FieldStatusTypeSchema = z.enum(['suggested', 'accepted', 'overridden', 'invalid']);
export type FieldStatusType = z.infer<typeof FieldStatusTypeSchema>;

export const FieldSourceDetailSchema = z.object({
  source: FieldSourceTypeSchema,
  status: FieldStatusTypeSchema,
  originalValue: z.any().optional(),
});
export type FieldSourceDetail = z.infer<typeof FieldSourceDetailSchema>;

export const FieldSourcesMapSchema = z.record(
  z.string(),
  z.union([FieldSourceTypeSchema, FieldSourceDetailSchema]),
);
export type FieldSourcesMap = z.infer<typeof FieldSourcesMapSchema>;

export const SetupDraftStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'EXPIRED', 'ABANDONED']);
export type SetupDraftStatus = z.infer<typeof SetupDraftStatusSchema>;

export const ExtractedProfileSchema = z.object({
  documentId: z.string().uuid().optional(),
  fullName: z.string().optional(),
  targetRole: z.string().optional(),
  seniorityLevel: z.string().optional(),
  skills: z.array(z.string()).default([]),
  experience: z.array(z.any()).default([]),
  education: z.array(z.string()).default([]),
  rawSummary: z.string().optional(),
  matchedJobRoleId: z.string().uuid().nullable().optional(),
  matchedSeniorityLevelId: z.string().uuid().nullable().optional(),
  matchedTechnologyIds: z.array(z.string().uuid()).default([]),
  unmatchedSkills: z.array(z.string()).default([]),
});
export type ExtractedProfile = z.infer<typeof ExtractedProfileSchema>;

export const InterviewSetupDraftDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  cvProfileId: z.string().uuid().nullable().optional(),
  jdProfileId: z.string().uuid().nullable().optional(),
  selectedPresetId: z.string().uuid().nullable().optional(),
  extractedProfile: ExtractedProfileSchema.nullable().optional(),
  configurationDraft: InterviewConfigurationDtoSchema,
  fieldSources: z.record(z.string(), FieldSourceDetailSchema),
  status: SetupDraftStatusSchema,
  expiresAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type InterviewSetupDraftDto = z.infer<typeof InterviewSetupDraftDtoSchema>;

export const CreateSetupDraftRequestDtoSchema = z.object({
  cvProfileId: z.string().uuid().optional(),
  jdProfileId: z.string().uuid().optional(),
  selectedPresetId: z.string().uuid().optional(),
  extractedProfile: ExtractedProfileSchema.optional(),
  configurationDraft: InterviewConfigurationDtoSchema.partial().optional(),
  fieldSources: z.record(z.string(), FieldSourceDetailSchema).optional(),
});
export type CreateSetupDraftRequestDto = z.infer<typeof CreateSetupDraftRequestDtoSchema>;

export const UpdateSetupDraftRequestDtoSchema = z.object({
  cvProfileId: z.string().uuid().nullable().optional(),
  jdProfileId: z.string().uuid().nullable().optional(),
  selectedPresetId: z.string().uuid().nullable().optional(),
  extractedProfile: ExtractedProfileSchema.nullable().optional(),
  configurationDraft: InterviewConfigurationDtoSchema.partial().optional(),
  fieldSources: z.record(z.string(), FieldSourceDetailSchema).optional(),
  status: SetupDraftStatusSchema.optional(),
});
export type UpdateSetupDraftRequestDto = z.infer<typeof UpdateSetupDraftRequestDtoSchema>;

export const AnalyzeProfileToDraftRequestDtoSchema = z.object({
  cvProfileId: z.string().uuid().optional(),
  jdProfileId: z.string().uuid().optional(),
  extractedData: ExtractedProfileSchema.optional(),
});
export type AnalyzeProfileToDraftRequestDto = z.infer<typeof AnalyzeProfileToDraftRequestDtoSchema>;

export const PresetConflictDiffDtoSchema = z.object({
  field: z.string(),
  label: z.string(),
  cvValue: z.any().optional(),
  presetValue: z.any().optional(),
  resolvedValue: z.any().optional(),
  action: z.enum(['use_cv', 'apply_preset', 'merge', 'manual', 'custom']),
  requiresConfirmation: z.boolean(),
});
export type PresetConflictDiffDto = z.infer<typeof PresetConflictDiffDtoSchema>;

export const ApplyPresetPreviewResponseDtoSchema = z.object({
  presetId: z.string().uuid(),
  presetName: z.string(),
  hasConflicts: z.boolean(),
  diffs: z.array(PresetConflictDiffDtoSchema),
  suggestedMergedConfig: InterviewConfigurationDtoSchema,
  suggestedFieldSources: z.record(z.string(), FieldSourceDetailSchema),
});
export type ApplyPresetPreviewResponseDto = z.infer<typeof ApplyPresetPreviewResponseDtoSchema>;

export const ConflictFieldResolutionSchema = z.object({
  source: z.enum(['cv', 'preset', 'manual']),
  customValue: z.any().optional(),
});

export const ResolveConflictsRequestDtoSchema = z.object({
  presetId: z.string().uuid(),
  resolutions: z.record(z.string(), ConflictFieldResolutionSchema),
});
export type ResolveConflictsRequestDto = z.infer<typeof ResolveConflictsRequestDtoSchema>;
