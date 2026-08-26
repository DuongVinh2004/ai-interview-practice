import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import { PresignUploadResponseDto, FileAssetDto, StorageCategory } from '@ai-interview/contracts';

export interface UploadOptions {
  file: File;
  category?: StorageCategory;
  isPublic?: boolean;
}

export function useCloudUpload() {
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [uploadedAsset, setUploadedAsset] = useState<FileAssetDto | null>(null);

  const uploadFile = useCallback(
    async ({
      file,
      category = 'documents',
      isPublic = false,
    }: UploadOptions): Promise<FileAssetDto> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        // Step 1: Request presigned upload URL from API
        const intent = await apiClient<PresignUploadResponseDto>('/storage/presign-upload', {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            category,
          }),
        });

        // Step 2: Upload file directly to S3 / Cloudflare R2 with XMLHttpRequest for progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = event => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setProgress(percent);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Cloud storage upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => {
            reject(new Error('Network error during cloud file upload'));
          };

          xhr.open('PUT', intent.uploadUrl, true);
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
          xhr.send(file);
        });

        // Step 3: Confirm upload with API to record FileAsset metadata
        const asset = await apiClient<FileAssetDto>('/storage/confirm', {
          method: 'POST',
          body: JSON.stringify({
            key: intent.key,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            isPublic,
          }),
        });

        setUploadedAsset(asset);
        setIsUploading(false);
        setProgress(100);
        return asset;
      } catch (err: any) {
        const uploadError = err instanceof Error ? err : new Error(err?.message || 'Upload failed');
        setError(uploadError);
        setIsUploading(false);
        throw uploadError;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setProgress(0);
    setIsUploading(false);
    setError(null);
    setUploadedAsset(null);
  }, []);

  return {
    uploadFile,
    progress,
    isUploading,
    error,
    uploadedAsset,
    reset,
  };
}
