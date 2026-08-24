import {
  CreateDeckRequestSchema,
  UpdateDeckRequestSchema,
  CreateFlashcardRequestSchema,
  ReviewCardRequestSchema,
  AutoGenerateFlashcardsRequestSchema,
} from '@ai-interview/contracts';

export type CreateDeckDto = typeof CreateDeckRequestSchema._type;
export type UpdateDeckDto = typeof UpdateDeckRequestSchema._type;
export type CreateFlashcardDto = typeof CreateFlashcardRequestSchema._type;
export type ReviewCardDto = typeof ReviewCardRequestSchema._type;
export type AutoGenerateFlashcardsDto = typeof AutoGenerateFlashcardsRequestSchema._type;
