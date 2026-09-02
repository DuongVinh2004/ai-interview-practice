import { Injectable, Inject, Optional, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../platform/prisma/prisma.service';
import { RedisService } from '../platform/redis/redis.service';
import { MetricsService } from '../platform/metrics/metrics.service';
import { StorageProvider } from './interfaces/storage-provider.interface';
import {
  ErrorCode,
  AuditAction,
  PresignUploadDto,
  PresignUploadResponseDto,
  PresignDownloadResponseDto,
  ConfirmUploadDto,
  FileAssetDto,
  UserRole,
  StorageCategory,
} from '@ai-interview/contracts';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

export const CATEGORY_POLICIES: Record<
  StorageCategory,
  { maxBytes: number; allowedMimes: string[] }
> = {
  documents: {
    maxBytes: 5 * 1024 * 1024,
    allowedMimes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
  },
  'system-design': {
    maxBytes: 2 * 1024 * 1024,
    allowedMimes: ['image/png', 'image/jpeg', 'image/webp', 'application/json'],
  },
  public: {
    maxBytes: 2 * 1024 * 1024,
    allowedMimes: ['image/png', 'image/jpeg', 'image/webp'],
  },
  temp: {
    maxBytes: 5 * 1024 * 1024,
    allowedMimes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/json',
    ],
  },
};

interface UploadIntentData {
  key: string;
  userId: string;
  filename: string;
  mimeType: string;
  category: string;
  isPublic?: boolean;
  expiresAt: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly memoryIntents = new Map<string, UploadIntentData>();
  private readonly INTENT_TTL_SECONDS = 3600; // 1 hour

  constructor(
    @Inject('STORAGE_PROVIDER') private readonly provider: StorageProvider,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  private normalizeKey(rawKey: string): string {
    if (!rawKey || typeof rawKey !== 'string') {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Invalid storage key.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let decoded = rawKey;
    try {
      decoded = decodeURIComponent(rawKey);
    } catch {
      // Use rawKey if decoding fails
    }

    const normalized = path.posix.normalize(decoded.replace(/\\/g, '/')).replace(/^\/+/, '');
    if (normalized.includes('..') || normalized.startsWith('/')) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Invalid storage key path.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return normalized;
  }

  private normalizeMimeType(mimeType: string | undefined): string {
    return (mimeType || '').split(';', 1)[0].trim().toLowerCase();
  }

  private isProduction(): boolean {
    const env = this.configService.get<string>('nodeEnv') || process.env.NODE_ENV;
    return env === 'production';
  }

  private async saveIntent(key: string, data: UploadIntentData): Promise<void> {
    const redisKey = `upload_intent:${key}`;
    const client = this.redisService?.getClient();
    if (client && client.status === 'ready') {
      try {
        await client.set(redisKey, JSON.stringify(data), 'EX', this.INTENT_TTL_SECONDS);
        return;
      } catch (err: any) {
        this.logger.warn(`Redis saveIntent failed: ${err.message}`);
        if (this.isProduction()) {
          throw new DomainException(
            ErrorCode.INTERNAL_SERVER_ERROR,
            'Upload intent store is currently unavailable.',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
      }
    } else if (this.isProduction()) {
      throw new DomainException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Upload intent store is currently unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    this.memoryIntents.set(redisKey, data);
  }

  private async getIntent(key: string): Promise<UploadIntentData | null> {
    const redisKey = `upload_intent:${key}`;
    const client = this.redisService?.getClient();
    if (client && client.status === 'ready') {
      try {
        const raw = await client.get(redisKey);
        if (raw) return JSON.parse(raw);
        return null;
      } catch (err: any) {
        this.logger.warn(`Redis getIntent failed: ${err.message}`);
        if (this.isProduction()) {
          throw new DomainException(
            ErrorCode.INTERNAL_SERVER_ERROR,
            'Upload intent store is currently unavailable.',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
      }
    } else if (this.isProduction()) {
      throw new DomainException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Upload intent store is currently unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const memoryIntent = this.memoryIntents.get(redisKey);
    if (memoryIntent) {
      if (Date.now() > memoryIntent.expiresAt) {
        this.memoryIntents.delete(redisKey);
        return null;
      }
      return memoryIntent;
    }
    return null;
  }

  private async deleteIntent(key: string): Promise<void> {
    const redisKey = `upload_intent:${key}`;
    const client = this.redisService?.getClient();
    if (client && client.status === 'ready') {
      try {
        await client.del(redisKey);
      } catch (err: any) {
        this.logger.warn(`Redis deleteIntent failed: ${err.message}`);
      }
    }
    this.memoryIntents.delete(redisKey);
  }

  async createUploadIntent(
    userId: string,
    dto: PresignUploadDto,
  ): Promise<PresignUploadResponseDto> {
    const isInvalidFilename =
      !dto.filename ||
      dto.filename.length > 128 ||
      Array.from(dto.filename).some(char => {
        const code = char.charCodeAt(0);
        return (code >= 0 && code <= 31) || code === 127 || char === '\\' || char === '/';
      });

    if (isInvalidFilename) {
      this.metricsService?.storageQuotaRejectionsTotal.inc({ reason: 'invalid_filename' });
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Invalid filename format or length.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const category = (dto.category || 'documents') as StorageCategory;
    const policy = CATEGORY_POLICIES[category];
    if (!policy || !policy.allowedMimes.includes(dto.mimeType)) {
      this.metricsService?.storageQuotaRejectionsTotal.inc({ reason: 'invalid_mime_or_category' });
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        `MIME type '${dto.mimeType}' is not allowed for category '${category}'.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const extension = path.extname(dto.filename);
    const sanitizedBase = path.basename(dto.filename, extension).replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = `${category}/${userId}/${uuidv4()}-${sanitizedBase}${extension}`;

    const uploadUrl = await this.provider.generatePresignedUploadUrl(key, dto.mimeType);

    // Save single-use expiring upload intent bound to authenticated userId
    await this.saveIntent(key, {
      key,
      userId,
      filename: dto.filename,
      mimeType: dto.mimeType,
      category,
      isPublic: category === 'public',
      expiresAt: Date.now() + this.INTENT_TTL_SECONDS * 1000,
    });

    this.metricsService?.storageUploadIntentsTotal.inc({ category, status: 'issued' });

    let publicUrl: string | undefined = undefined;
    if (category === 'public') {
      const cdnUrl =
        this.configService.get<string>('storage.publicCdnUrl') || 'https://cdn.ai-interview.dev';
      publicUrl = `${cdnUrl}/${key}`;
    }

    return {
      uploadUrl,
      key,
      filename: dto.filename,
      publicUrl,
    };
  }

  async confirmUpload(userId: string, dto: ConfirmUploadDto): Promise<FileAssetDto> {
    const normalizedKey = this.normalizeKey(dto.key);

    // 1. Verify that a valid, single-use upload intent exists for this key
    const intent = await this.getIntent(normalizedKey);
    if (!intent) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'No valid or active upload intent found for this storage key.',
        HttpStatus.FORBIDDEN,
      );
    }

    // 2. Validate that the intent belongs to the authenticated caller
    if (intent.userId !== userId) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You are not authorized to confirm an upload initiated by another user.',
        HttpStatus.FORBIDDEN,
      );
    }

    // The confirmation body is untrusted. Keep the capability's original
    // metadata authoritative so a caller cannot rebind an upload key to a
    // different filename, MIME type, or visibility after presigning it.
    if (
      intent.key !== normalizedKey ||
      dto.filename !== intent.filename ||
      this.normalizeMimeType(dto.mimeType) !== this.normalizeMimeType(intent.mimeType) ||
      dto.isPublic !== Boolean(intent.isPublic)
    ) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Upload confirmation metadata does not match the upload intent.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Verify key prefix matches caller identity
    const keyParts = normalizedKey.split('/');
    if (keyParts.length < 3 || keyParts[1] !== userId) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Storage key prefix does not match the authenticated user.',
        HttpStatus.FORBIDDEN,
      );
    }

    // 4. Replay protection: ensure key is not already confirmed
    const existingAsset = await this.prisma.fileAsset.findUnique({
      where: { key: normalizedKey },
    });
    if (existingAsset) {
      throw new DomainException(
        ErrorCode.IDEMPOTENCY_CONFLICT,
        'This storage key has already been confirmed as an asset.',
        HttpStatus.CONFLICT,
      );
    }

    // 5. Verify cloud object exists in storage provider
    const metadata = await this.provider.getObjectMetadata(normalizedKey);
    if (!metadata) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Uploaded file object not found in cloud storage.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (this.normalizeMimeType(metadata.contentType) !== this.normalizeMimeType(intent.mimeType)) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Uploaded object content type does not match the upload intent.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 6. Enforce category byte cap (SEC-001 / PRD-1003)
    const categoryPolicy = CATEGORY_POLICIES[intent.category as StorageCategory];
    if (categoryPolicy && metadata.size > categoryPolicy.maxBytes) {
      this.metricsService?.storageQuotaRejectionsTotal.inc({ reason: 'byte_cap_exceeded' });
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        `Uploaded file size (${metadata.size} bytes) exceeds the maximum allowed ${categoryPolicy.maxBytes} bytes for category '${intent.category}'.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const bucket =
      this.configService.get<string>('storage.awsS3Bucket') ||
      this.configService.get<string>('storage.r2Bucket') ||
      'ai-interview-storage';

    const isPublic = intent.category === 'public';
    let publicUrl: string | undefined = undefined;
    if (isPublic || normalizedKey.startsWith('public/')) {
      const cdnUrl =
        this.configService.get<string>('storage.publicCdnUrl') || 'https://cdn.ai-interview.dev';
      publicUrl = `${cdnUrl}/${normalizedKey}`;
    }

    const asset = await this.prisma.fileAsset.create({
      data: {
        key: normalizedKey,
        bucket,
        filename: intent.filename,
        mimeType: intent.mimeType,
        sizeBytes: metadata.size,
        url: publicUrl,
        isPublic,
        userId,
      },
    });

    // 7. Invalidate/consume upload intent (single-use)
    await this.deleteIntent(normalizedKey);

    this.metricsService?.storageUploadIntentsTotal.inc({
      category: intent.category,
      status: 'confirmed',
    });
    this.metricsService?.storageConfirmedBytesTotal.inc(
      { category: intent.category },
      metadata.size,
    );

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.FILE_UPLOADED,
        resource: 'file_asset',
        resourceId: asset.id,
        details: { key: asset.key, sizeBytes: asset.sizeBytes, mimeType: asset.mimeType },
      },
    });

    return {
      id: asset.id,
      key: asset.key,
      bucket: asset.bucket,
      filename: asset.filename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      url: asset.url || undefined,
      isPublic: asset.isPublic,
      userId: asset.userId,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    };
  }

  async createDownloadIntent(
    userId: string,
    key: string,
    userRole?: string | UserRole,
  ): Promise<PresignDownloadResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    const asset = await this.prisma.fileAsset.findUnique({
      where: { key: normalizedKey },
    });

    // FAIL CLOSED: Unregistered keys MUST NOT be signed or downloaded
    if (!asset) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'File asset not found or not registered.',
        HttpStatus.NOT_FOUND,
      );
    }

    const isAdmin = userRole === UserRole.ADMIN || userRole === 'ADMIN';
    if (!asset.isPublic && asset.userId !== userId && !isAdmin) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You are not authorized to download this private asset.',
        HttpStatus.FORBIDDEN,
      );
    }

    const downloadUrl = await this.provider.generatePresignedDownloadUrl(normalizedKey);
    return { downloadUrl, key: normalizedKey };
  }

  async deleteFile(userId: string, key: string, userRole?: string | UserRole): Promise<void> {
    const normalizedKey = this.normalizeKey(key);

    const asset = await this.prisma.fileAsset.findUnique({
      where: { key: normalizedKey },
    });

    // FAIL CLOSED: Unregistered keys MUST NOT be deleted
    if (!asset) {
      this.metricsService?.storageDeletionEventsTotal.inc({ status: 'not_found' });
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'File asset not found or not registered.',
        HttpStatus.NOT_FOUND,
      );
    }

    const isAdmin = userRole === UserRole.ADMIN || userRole === 'ADMIN';
    if (asset.userId !== userId && !isAdmin) {
      this.metricsService?.storageDeletionEventsTotal.inc({ status: 'unauthorized' });
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You are not authorized to delete this file.',
        HttpStatus.FORBIDDEN,
      );
    }

    // Never delete database metadata before cloud provider confirmation
    try {
      await this.provider.deleteObject(normalizedKey);
    } catch (err: any) {
      this.metricsService?.storageDeletionEventsTotal.inc({ status: 'provider_failed' });
      this.logger.error(
        `Cloud provider failed to delete object [${normalizedKey}]: ${err.message}`,
      );
      throw err;
    }

    await this.prisma.fileAsset.delete({ where: { id: asset.id } });
    this.metricsService?.storageDeletionEventsTotal.inc({ status: 'success' });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.FILE_DELETED,
        resource: 'file_asset',
        resourceId: asset.id,
        details: { key: normalizedKey },
      },
    });
  }

  async reconcileOrphanFiles(userId?: string): Promise<{ scanned: number; reconciled: number }> {
    const assets = await this.prisma.fileAsset.findMany({
      where: userId ? { userId } : undefined,
      take: 100,
    });

    let reconciled = 0;
    for (const asset of assets) {
      const metadata = await this.provider.getObjectMetadata(asset.key);
      if (!metadata) {
        this.logger.warn(
          `Orphan metadata detected for asset [${asset.id}], key [${asset.key}]. Reconciling...`,
        );
        await this.prisma.fileAsset.delete({ where: { id: asset.id } });
        await this.prisma.auditLog.create({
          data: {
            userId: asset.userId,
            action: AuditAction.FILE_DELETED,
            resource: 'file_asset',
            resourceId: asset.id,
            details: { key: asset.key, reason: 'reconcile_orphan_metadata_purged' },
          },
        });
        this.metricsService?.storageDeletionEventsTotal.inc({ status: 'reconciled_orphan' });
        reconciled++;
      }
    }

    return { scanned: assets.length, reconciled };
  }

  async getFileAsset(key: string): Promise<FileAssetDto | null> {
    const normalizedKey = this.normalizeKey(key);
    const asset = await this.prisma.fileAsset.findUnique({
      where: { key: normalizedKey },
    });
    if (!asset) return null;
    return {
      id: asset.id,
      key: asset.key,
      bucket: asset.bucket,
      filename: asset.filename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      url: asset.url || undefined,
      isPublic: asset.isPublic,
      userId: asset.userId,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    };
  }
}
