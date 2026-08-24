import {
  CreateTutorSessionRequestSchema,
  AskTutorRequestSchema,
  QuestionRetryRequestSchema,
  TutorRatingRequestSchema,
} from '@ai-interview/contracts';

export type CreateTutorSessionDto = typeof CreateTutorSessionRequestSchema._type;
export type AskTutorDto = typeof AskTutorRequestSchema._type;
export type QuestionRetryDto = typeof QuestionRetryRequestSchema._type;
export type TutorRatingDto = typeof TutorRatingRequestSchema._type;
