import { z } from 'zod';
import { ErrorCode } from '../enums';

export const PaginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

export const ApiFieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export type ApiFieldError = z.infer<typeof ApiFieldErrorSchema>;

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  code: z.nativeEnum(ErrorCode),
  message: z.string(),
  errors: z.array(ApiFieldErrorSchema).optional(),
  requestId: z.string().optional(),
  timestamp: z.string(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export function createSuccessResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
    meta: PaginationMetaSchema.optional(),
    requestId: z.string().optional(),
    timestamp: z.string(),
  });
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationMeta;
  requestId?: string;
  timestamp: string;
}
