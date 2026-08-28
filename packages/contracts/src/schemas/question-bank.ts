import { z } from 'zod';
import {
  QuestionPublicationStatus,
  QuestionAnswerAuthority,
  QuestionFeedbackReason,
  QuestionFeedbackStatus,
} from '../enums';
import { JobRoleDtoSchema, SeniorityLevelDtoSchema, TechnologyDtoSchema } from './taxonomy';

export const QuestionPublicationStatusSchema = z.nativeEnum(QuestionPublicationStatus);
export const QuestionAnswerAuthoritySchema = z.nativeEnum(QuestionAnswerAuthority);
export const QuestionFeedbackReasonSchema = z.nativeEnum(QuestionFeedbackReason);
export const QuestionFeedbackStatusSchema = z.nativeEnum(QuestionFeedbackStatus);

export const QuestionBankAnswerDtoSchema = z.object({
  id: z.string().uuid(),
  questionId: z.string().uuid(),
  version: z.number().int().min(1),
  authority: QuestionAnswerAuthoritySchema,
  answerBody: z.string(),
  explanationBody: z.string().nullable().optional(),
  rubric: z.any().nullable().optional(),
  commonMistakes: z.any().nullable().optional(),
  sourceType: z.string(),
  reviewedById: z.string().uuid().nullable().optional(),
  reviewedAt: z.string().nullable().optional(),
  reviewNotes: z.string().nullable().optional(),
  isPublished: z.boolean(),
  createdAt: z.string(),
});

export type QuestionBankAnswerDto = z.infer<typeof QuestionBankAnswerDtoSchema>;

export const QuestionBankQuestionDtoSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  questionBody: z.string(),
  questionType: z.string(),
  difficulty: z.number().int().min(1).max(5),
  language: z.string(),
  status: QuestionPublicationStatusSchema,
  minimumEntitlement: z.string().nullable().optional(),
  currentAnswerId: z.string().uuid().nullable().optional(),
  currentAnswerVersion: z.number().int().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
  createdById: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  jobRole: JobRoleDtoSchema.nullable().optional(),
  seniorityLevel: SeniorityLevelDtoSchema.nullable().optional(),
  technologies: z.array(TechnologyDtoSchema).optional(),
  isBookmarked: z.boolean().optional(),
  isRevealed: z.boolean().optional(),
  previewAvailable: z.boolean().optional(),
});

export type QuestionBankQuestionDto = z.infer<typeof QuestionBankQuestionDtoSchema>;

export const QuestionBankQuestionDetailDtoSchema = QuestionBankQuestionDtoSchema.extend({
  answer: QuestionBankAnswerDtoSchema.nullable().optional(),
  revealedAt: z.string().nullable().optional(),
  disclaimer: z.string().optional(),
  relatedQuestions: z.array(QuestionBankQuestionDtoSchema).optional(),
});

export type QuestionBankQuestionDetailDto = z.infer<typeof QuestionBankQuestionDetailDtoSchema>;

export const RevealAnswerResponseDtoSchema = z.object({
  data: QuestionBankAnswerDtoSchema,
  meta: z.object({
    access: z.enum(['new_grant', 'existing_grant']),
    quota: z.object({
      limit: z.union([z.number(), z.literal('unlimited')]),
      used: z.number(),
      remaining: z.union([z.number(), z.literal('unlimited')]),
      resetsAt: z.string(),
    }),
  }),
});

export type RevealAnswerResponseDto = z.infer<typeof RevealAnswerResponseDtoSchema>;

export const QuestionBankQueryDtoSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  role: z.string().optional(),
  seniority: z.string().optional(),
  technology: z.string().optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  questionType: z.string().optional(),
  language: z.string().optional(),
});

export type QuestionBankQueryDto = z.infer<typeof QuestionBankQueryDtoSchema>;

export const QuestionBankAccessStatusDtoSchema = z.object({
  planSlug: z.string(),
  planName: z.string(),
  browseAllowed: z.boolean(),
  advancedFiltersAllowed: z.boolean(),
  expertContentAllowed: z.boolean(),
  rubricsAllowed: z.boolean(),
  revealsLimit: z.union([z.number(), z.literal('unlimited')]),
  revealsUsed: z.number(),
  revealsRemaining: z.union([z.number(), z.literal('unlimited')]),
  periodResetsAt: z.string(),
  accessPeriodKey: z.string(),
});

export type QuestionBankAccessStatusDto = z.infer<typeof QuestionBankAccessStatusDtoSchema>;

export const CreateQuestionFeedbackDtoSchema = z.object({
  reason: QuestionFeedbackReasonSchema,
  details: z.string().max(2000).optional(),
});

export type CreateQuestionFeedbackDto = z.infer<typeof CreateQuestionFeedbackDtoSchema>;

export const QuestionFeedbackDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  questionId: z.string().uuid(),
  reason: QuestionFeedbackReasonSchema,
  details: z.string().nullable().optional(),
  status: QuestionFeedbackStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type QuestionFeedbackDto = z.infer<typeof QuestionFeedbackDtoSchema>;

export const AdminCreateQuestionDtoSchema = z.object({
  title: z.string().min(3).max(255),
  slug: z.string().min(3).max(120).optional(),
  questionBody: z.string().min(10),
  questionType: z.string().min(1),
  difficulty: z.number().int().min(1).max(5).default(3),
  language: z.string().default('vi'),
  jobRoleId: z.string().uuid().optional(),
  seniorityLevelId: z.string().uuid().optional(),
  technologyIds: z.array(z.string().uuid()).optional(),
  minimumEntitlement: z.string().optional(),
  initialAnswer: z.object({
    authority: QuestionAnswerAuthoritySchema.default(QuestionAnswerAuthority.REFERENCE),
    answerBody: z.string().min(10),
    explanationBody: z.string().optional(),
    rubric: z.any().optional(),
    commonMistakes: z.any().optional(),
    sourceType: z.string().default('curated'),
  }),
});

export type AdminCreateQuestionDto = z.infer<typeof AdminCreateQuestionDtoSchema>;

export const AdminUpdateQuestionDtoSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  slug: z.string().min(3).max(120).optional(),
  questionBody: z.string().min(10).optional(),
  questionType: z.string().min(1).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  language: z.string().optional(),
  jobRoleId: z.string().uuid().nullable().optional(),
  seniorityLevelId: z.string().uuid().nullable().optional(),
  technologyIds: z.array(z.string().uuid()).optional(),
  minimumEntitlement: z.string().nullable().optional(),
  answerBody: z.string().optional(),
  authority: QuestionAnswerAuthoritySchema.optional(),
  explanationBody: z.string().optional(),
  rubric: z.any().optional(),
  commonMistakes: z.any().optional(),
  sourceType: z.string().optional(),
});

export type AdminUpdateQuestionDto = z.infer<typeof AdminUpdateQuestionDtoSchema>;

export const AdminReviewQuestionDtoSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reviewNotes: z.string().max(1000).optional(),
});

export type AdminReviewQuestionDto = z.infer<typeof AdminReviewQuestionDtoSchema>;

export const ReconciliationReportDtoSchema = z.object({
  checkedAt: z.string(),
  totalGrants: z.number(),
  totalUsageRecords: z.number(),
  orphanedGrants: z.array(z.string()),
  orphanedUsageRecords: z.array(z.string()),
  isHealthy: z.boolean(),
});

export type ReconciliationReportDto = z.infer<typeof ReconciliationReportDtoSchema>;
