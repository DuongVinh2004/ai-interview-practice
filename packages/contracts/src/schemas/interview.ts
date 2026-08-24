import { z } from 'zod';
import { DifficultyLevel, SessionState, SessionMode, CompetencyArea } from '../enums';
import { JobRoleDtoSchema, SeniorityLevelDtoSchema, TechnologyDtoSchema } from './taxonomy';
import { EvaluationDtoSchema } from './evaluation';
import { LearningPathDtoSchema } from './learning-path';

export const CreateInterviewDtoSchema = z.object({
  jobRoleId: z.string().uuid('Job role ID must be a valid UUID'),
  seniorityLevelId: z.string().uuid('Seniority level ID must be a valid UUID'),
  technologyIds: z
    .array(z.string().uuid('Technology ID must be a valid UUID'))
    .min(1, 'Select at least one technology')
    .max(5, 'You can select up to 5 technologies'),
  sessionMode: z.nativeEnum(SessionMode).default(SessionMode.STANDARD),
  competencyArea: z.nativeEnum(CompetencyArea).optional(),
  totalTurns: z.number().int().min(1).max(5).default(5),
  isSandbox: z.boolean().default(false),
  blueprintId: z.string().uuid().optional(),
});


export type CreateInterviewDto = z.infer<typeof CreateInterviewDtoSchema>;

export const SubmitAnswerDtoSchema = z.object({
  turnId: z.string().uuid('Turn ID must be a valid UUID'),
  answerText: z
    .string()
    .trim()
    .min(1, 'Answer text cannot be empty')
    .max(5000, 'Answer text cannot exceed 5000 characters'),
});

export type SubmitAnswerDto = z.infer<typeof SubmitAnswerDtoSchema>;

export const QuestionDtoSchema = z.object({
  id: z.string().uuid(),
  turnId: z.string().uuid(),
  content: z.string(),
  difficulty: z.nativeEnum(DifficultyLevel),
  keyFocus: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type QuestionDto = z.infer<typeof QuestionDtoSchema>;

export const AnswerDtoSchema = z.object({
  id: z.string().uuid(),
  turnId: z.string().uuid(),
  content: z.string(),
  submittedAt: z.string(),
  evaluation: EvaluationDtoSchema.nullable().optional(),
});

export type AnswerDto = z.infer<typeof AnswerDtoSchema>;

export const InterviewTurnDtoSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  turnNumber: z.number().int().min(1).max(5),
  difficulty: z.nativeEnum(DifficultyLevel),
  status: z.enum(['PENDING', 'QUESTION_READY', 'ANSWER_SUBMITTED', 'EVALUATED', 'FAILED']),
  isFollowUp: z.boolean().default(false),
  parentTurnNumber: z.number().int().nullable().optional(),
  question: QuestionDtoSchema.nullable().optional(),
  answer: AnswerDtoSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type InterviewTurnDto = z.infer<typeof InterviewTurnDtoSchema>;

export const InterviewSessionDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  state: z.nativeEnum(SessionState),
  sessionMode: z.nativeEnum(SessionMode).default(SessionMode.STANDARD),
  competencyArea: z.nativeEnum(CompetencyArea).nullable().optional(),
  isSandbox: z.boolean().default(false),
  currentTurn: z.number().int().min(1).max(5),
  totalTurns: z.number().int().min(1).max(5).default(5),
  targetDifficulty: z.nativeEnum(DifficultyLevel),
  overallScore: z.number().nullable().optional(),
  jobRole: JobRoleDtoSchema,
  seniorityLevel: SeniorityLevelDtoSchema,
  technologies: z.array(TechnologyDtoSchema),
  turns: z.array(InterviewTurnDtoSchema),
  learningPath: LearningPathDtoSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type InterviewSessionDto = z.infer<typeof InterviewSessionDtoSchema>;

export const SessionStatusResponseSchema = z.object({
  id: z.string().uuid(),
  state: z.nativeEnum(SessionState),
  sessionMode: z.nativeEnum(SessionMode).optional(),
  isSandbox: z.boolean().optional(),
  currentTurn: z.number().int().min(1).max(5),
  totalTurns: z.number().int().min(1).max(5).default(5),
  latestTurn: InterviewTurnDtoSchema.nullable().optional(),
  overallScore: z.number().nullable().optional(),
  updatedAt: z.string(),
});

export type SessionStatusResponse = z.infer<typeof SessionStatusResponseSchema>;

export const HistoryQueryDtoSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  state: z.nativeEnum(SessionState).optional(),
  jobRoleId: z.string().uuid().optional(),
  sessionMode: z.nativeEnum(SessionMode).optional(),
  search: z.string().optional(),
  minScore: z.coerce.number().min(0).max(10).optional(),
  maxScore: z.coerce.number().min(0).max(10).optional(),
});

export type HistoryQueryDto = z.infer<typeof HistoryQueryDtoSchema>;

export const ReEvaluateTurnDtoSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type ReEvaluateTurnDto = z.infer<typeof ReEvaluateTurnDtoSchema>;

