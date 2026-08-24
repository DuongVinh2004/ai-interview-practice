import { z } from 'zod';
import { TutorRole } from '../enums/index';

export const TutorMessageDtoSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: z.nativeEnum(TutorRole),
  content: z.string(),
  references: z.any().nullable().optional(),
  createdAt: z.string().or(z.date()),
});
export type TutorMessageDto = z.infer<typeof TutorMessageDtoSchema>;

export const TutorSessionDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  interviewId: z.string().uuid(),
  turnNumber: z.number().int(),
  turnCount: z.number().int(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  messages: z.array(TutorMessageDtoSchema).default([]),
});
export type TutorSessionDto = z.infer<typeof TutorSessionDtoSchema>;

export const CreateTutorSessionRequestSchema = z.object({
  interviewId: z.string().uuid(),
  turnNumber: z.number().int().min(1).max(10),
});
export type CreateTutorSessionRequest = z.infer<typeof CreateTutorSessionRequestSchema>;

export const AskTutorRequestSchema = z.object({
  message: z.string().min(1).max(1000, 'Message cannot exceed 1000 characters'),
});
export type AskTutorRequest = z.infer<typeof AskTutorRequestSchema>;

export const QuestionRetryRequestSchema = z.object({
  interviewId: z.string().uuid(),
  turnNumber: z.number().int().min(1).max(10),
  retryAnswer: z.string().min(10, 'Answer must contain at least 10 characters'),
});
export type QuestionRetryRequest = z.infer<typeof QuestionRetryRequestSchema>;

export const QuestionRetryResponseSchema = z.object({
  retryId: z.string().uuid(),
  interviewId: z.string().uuid(),
  turnNumber: z.number().int(),
  originalAnswer: z.string(),
  retryAnswer: z.string(),
  originalScore: z.number(),
  retryScore: z.number(),
  improvement: z.number(),
  feedback: z.object({
    summary: z.string(),
    keyStrengths: z.array(z.string()).default([]),
    remainingGaps: z.array(z.string()).default([]),
    modelComparison: z.string().optional(),
  }),
  createdAt: z.string().or(z.date()),
});
export type QuestionRetryResponse = z.infer<typeof QuestionRetryResponseSchema>;

export const TutorRatingRequestSchema = z.object({
  rating: z.enum(['UP', 'DOWN']),
  feedback: z.string().max(500).optional(),
});
export type TutorRatingRequest = z.infer<typeof TutorRatingRequestSchema>;
