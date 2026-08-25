import { z } from 'zod';
import { LearningPathStatus } from '../enums';

export const LearningPathItemDtoSchema = z.object({
  id: z.string().uuid().optional(),
  gap: z.string(),
  topic: z.string(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  recommendedAction: z.string(),
  searchKeywords: z.array(z.string()),
  order: z.number().int().nonnegative(),
  isCompleted: z.boolean().default(false),
  completedAt: z.string().nullable().optional(),
});

export type LearningPathItemDto = z.infer<typeof LearningPathItemDtoSchema>;

export const UpdateLearningPathItemDtoSchema = z.object({
  isCompleted: z.boolean(),
});

export type UpdateLearningPathItemDto = z.infer<typeof UpdateLearningPathItemDtoSchema>;

export const LearningPathDtoSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  status: z.nativeEnum(LearningPathStatus),
  summary: z.string().nullable().optional(),
  items: z.array(LearningPathItemDtoSchema),
  errorMessage: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type LearningPathDto = z.infer<typeof LearningPathDtoSchema>;
