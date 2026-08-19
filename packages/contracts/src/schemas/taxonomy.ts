import { z } from 'zod';

export const JobRoleDtoSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
});

export type JobRoleDto = z.infer<typeof JobRoleDtoSchema>;

export const SeniorityLevelDtoSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  order: z.number().int(),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
});

export type SeniorityLevelDto = z.infer<typeof SeniorityLevelDtoSchema>;

export const TechnologyDtoSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  category: z.string().nullable().optional(),
  isActive: z.boolean(),
});

export type TechnologyDto = z.infer<typeof TechnologyDtoSchema>;
