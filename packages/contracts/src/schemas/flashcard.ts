import { z } from 'zod';
import { CardType, CardState, FSRSRating } from '../enums/index';

export const FlashcardDtoSchema = z.object({
  id: z.string().uuid(),
  deckId: z.string().uuid(),
  type: z.nativeEnum(CardType),
  frontContent: z.string(),
  backContent: z.string(),
  metadata: z.any().nullable().optional(),
  due: z.string().or(z.date()),
  stability: z.number(),
  difficulty: z.number(),
  elapsedDays: z.number(),
  scheduledDays: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.nativeEnum(CardState),
  lastReview: z.string().or(z.date()).nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type FlashcardDto = z.infer<typeof FlashcardDtoSchema>;

export const FlashcardDeckDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  cardCount: z.number().default(0),
  dueCount: z.number().default(0),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type FlashcardDeckDto = z.infer<typeof FlashcardDeckDtoSchema>;

export const ReviewLogDtoSchema = z.object({
  id: z.string().uuid(),
  flashcardId: z.string().uuid(),
  rating: z.nativeEnum(FSRSRating),
  state: z.nativeEnum(CardState),
  due: z.string().or(z.date()),
  stability: z.number(),
  difficulty: z.number(),
  elapsedDays: z.number(),
  scheduledDays: z.number(),
  reviewedAt: z.string().or(z.date()),
  durationMs: z.number(),
});
export type ReviewLogDto = z.infer<typeof ReviewLogDtoSchema>;

export const CreateDeckRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type CreateDeckRequest = z.infer<typeof CreateDeckRequestSchema>;

export const UpdateDeckRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdateDeckRequest = z.infer<typeof UpdateDeckRequestSchema>;

export const CreateFlashcardRequestSchema = z.object({
  deckId: z.string().uuid(),
  type: z.nativeEnum(CardType).default(CardType.CONCEPT),
  frontContent: z.string().min(1),
  backContent: z.string().min(1),
  metadata: z.any().optional(),
});
export type CreateFlashcardRequest = z.infer<typeof CreateFlashcardRequestSchema>;

export const ReviewCardRequestSchema = z.object({
  rating: z.nativeEnum(FSRSRating),
  durationMs: z.number().int().min(0).default(0),
});
export type ReviewCardRequest = z.infer<typeof ReviewCardRequestSchema>;

export const AutoGenerateFlashcardsRequestSchema = z.object({
  interviewId: z.string().uuid(),
  deckId: z.string().uuid().optional(),
});
export type AutoGenerateFlashcardsRequest = z.infer<typeof AutoGenerateFlashcardsRequestSchema>;

export const UserStreakDtoSchema = z.object({
  currentStreak: z.number(),
  longestStreak: z.number(),
  lastReviewDate: z.string().nullable().optional(),
  totalReviews: z.number(),
});
export type UserStreakDto = z.infer<typeof UserStreakDtoSchema>;

export const HeatmapEntrySchema = z.object({
  date: z.string(),
  count: z.number(),
});
export type HeatmapEntry = z.infer<typeof HeatmapEntrySchema>;

export const FlashcardStatsDtoSchema = z.object({
  totalCards: z.number(),
  dueToday: z.number(),
  newCards: z.number(),
  learningCards: z.number(),
  reviewCards: z.number(),
  relearningCards: z.number(),
  streak: UserStreakDtoSchema,
  heatmap: z.array(HeatmapEntrySchema),
});
export type FlashcardStatsDto = z.infer<typeof FlashcardStatsDtoSchema>;
