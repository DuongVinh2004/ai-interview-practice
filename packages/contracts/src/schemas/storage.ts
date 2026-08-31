import { z } from 'zod';

export const StorageCategorySchema = z.enum(['public', 'documents', 'system-design', 'temp']);
export type StorageCategory = z.infer<typeof StorageCategorySchema>;

export const PresignUploadSchema = z.object({
  filename: z.string().min(1).max(128),
  mimeType: z.string().min(1),
  category: StorageCategorySchema.default('documents'),
});
export type PresignUploadDto = z.infer<typeof PresignUploadSchema>;

export const PresignUploadResponseSchema = z.object({
  uploadUrl: z.string(),
  key: z.string(),
  filename: z.string(),
  publicUrl: z.string().optional(),
});
export type PresignUploadResponseDto = z.infer<typeof PresignUploadResponseSchema>;

export const PresignDownloadResponseSchema = z.object({
  downloadUrl: z.string(),
  key: z.string(),
});
export type PresignDownloadResponseDto = z.infer<typeof PresignDownloadResponseSchema>;

export const ConfirmUploadSchema = z.object({
  key: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  isPublic: z.boolean().default(false),
});
export type ConfirmUploadDto = z.infer<typeof ConfirmUploadSchema>;

export const FileAssetSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  bucket: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  url: z.string().nullable().optional(),
  isPublic: z.boolean(),
  userId: z.string().uuid(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type FileAssetDto = z.infer<typeof FileAssetSchema>;
