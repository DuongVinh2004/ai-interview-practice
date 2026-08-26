import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { StorageProvider, ObjectMetadata } from '../interfaces/storage-provider.interface';
import { ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

@Injectable()
export class MockStorageProvider implements StorageProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockStorageProvider.name);
  private readonly mockFiles = new Map<
    string,
    { size: number; contentType: string; lastModified: Date }
  >();

  private checkProductionGuard() {
    const isProduction =
      process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
    const allowMock = process.env.ALLOW_MOCK_PROVIDERS === 'true';

    if (isProduction && !allowMock) {
      this.logger.error(
        'MockStorageProvider invoked in production without ALLOW_MOCK_PROVIDERS=true',
      );
      throw new DomainException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Object storage service is currently unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async generatePresignedUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    this.checkProductionGuard();
    this.logger.log(`[MockStorage] Generated presigned upload URL for key: ${key}`);
    // Register temporary mock object metadata
    this.mockFiles.set(key, {
      size: 1024 * 50, // 50KB default mock size
      contentType: mimeType,
      lastModified: new Date(),
    });
    return `https://mock-storage.ai-interview.dev/upload/${encodeURIComponent(key)}?expires=${expiresInSeconds}`;
  }

  async generatePresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    this.checkProductionGuard();
    this.logger.log(`[MockStorage] Generated presigned download URL for key: ${key}`);
    return `https://mock-storage.ai-interview.dev/download/${encodeURIComponent(key)}?expires=${expiresInSeconds}`;
  }

  async deleteObject(key: string): Promise<void> {
    this.checkProductionGuard();
    this.logger.log(`[MockStorage] Deleted object: ${key}`);
    this.mockFiles.delete(key);
  }

  async getObjectMetadata(key: string): Promise<ObjectMetadata | null> {
    this.checkProductionGuard();
    const file = this.mockFiles.get(key);
    if (!file) {
      // Default fallback metadata for simulated uploads
      return {
        size: 1024 * 100, // 100 KB
        contentType: 'application/octet-stream',
        lastModified: new Date(),
      };
    }
    return file;
  }
}
