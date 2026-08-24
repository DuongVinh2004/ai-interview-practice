import { z } from 'zod';
import { UserRole, UserStatus } from '../enums';

export const UserQueryDtoSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export type UserQueryDto = z.infer<typeof UserQueryDtoSchema>;


export const AiRunQueryDtoSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  provider: z.string().optional(),
  status: z.enum(['SUCCESS', 'FAILED']).optional(),
  sessionId: z.string().uuid().optional(),
});

export type AiRunQueryDto = z.infer<typeof AiRunQueryDtoSchema>;

export const PromptVersionActivateDtoSchema = z.object({
  versionId: z.string().uuid(),
});

export type PromptVersionActivateDto = z.infer<typeof PromptVersionActivateDtoSchema>;
