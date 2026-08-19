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

export const UpdateProfileDtoSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  targetRole: z.string().max(100).optional(),
  targetLevel: z.string().max(50).optional(),
  bio: z.string().max(500).optional(),
});

export type UpdateProfileDto = z.infer<typeof UpdateProfileDtoSchema>;
