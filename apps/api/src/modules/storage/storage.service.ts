import { Injectable, Inject, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../platform/prisma/prisma.service';
import { StorageProvider } from './interfaces/storage-provider.interface';
import {
  ErrorCode,
  AuditAction,
  PresignUploadDto,
  PresignUploadResponseDto,
  PresignDownloadResponseDto,
  ConfirmUploadDto,
  FileAssetDto,
} from '@ai-interview/contracts';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject('STORAGE_PROVIDER') private readonly provider: StorageProvider,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createUploadIntent(
    userId: string,
    dto: PresignUploadDto,
  ): Promise<PresignUploadResponseDto> {
    const extension = path.extname(dto.filename);
    const sanitizedBase = path.basename(dto.filename, extension).replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = `${dto.category}/${userId}/${uuidv4()}-${sanitizedBase}${extension}`;

    const uploadUrl = await this.provider.generatePresignedUploadUrl(key, dto.mimeType);

    let publicUrl: string | undefined = undefined;
    if (dto.category === 'public') {
      const cdnUrl =
        this.configService.get<string>('storage.publicCdnUrl') ||
        'https://cdn.ai-interview.dev';
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
    const metadata = await this.provider.getObjectMetadata(dto.key);
    if (!metadata) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Uploaded file object not found in cloud storage.',
        HttpStatus.NOT_FOUND,
      );
    }

    const bucket =
      this.configService.get<string>('storage.awsS3Bucket') ||
      this.configService.get<string>('storage.r2Bucket') ||
      'ai-interview-storage';

    let publicUrl: string | undefined = undefined;
    if (dto.isPublic || dto.key.startsWith('public/')) {
      const cdnUrl =
        this.configService.get<string>('storage.publicCdnUrl') ||
        'https://cdn.ai-interview.dev';
      publicUrl = `${cdnUrl}/${dto.key}`;
    }

    const asset = await this.prisma.fileAsset.create({
      data: {
        key: dto.key,
        bucket,
        filename: dto.filename,
        mimeType: dto.mimeType,
        sizeBytes: metadata.size,
        url: publicUrl,
        isPublic: dto.isPublic || dto.key.startsWith('public/'),
        userId,
      },
    });

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
    userRole?: string,
  ): Promise<PresignDownloadResponseDto> {
    const asset = await this.prisma.fileAsset.findUnique({
      where: { key },
    });

    if (asset) {
      if (!asset.isPublic && asset.userId !== userId && userRole !== 'ADMIN') {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'You are not authorized to download this private asset.',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const downloadUrl = await this.provider.generatePresignedDownloadUrl(key);
    return { downloadUrl, key };
  }

  async deleteFile(userId: string, key: string, userRole?: string): Promise<void> {
    const asset = await this.prisma.fileAsset.findUnique({
      where: { key },
    });

    if (asset) {
      if (asset.userId !== userId && userRole !== 'ADMIN') {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'You are not authorized to delete this file.',
          HttpStatus.FORBIDDEN,
        );
      }
      await this.prisma.fileAsset.delete({ where: { id: asset.id } });
    }

    await this.provider.deleteObject(key);

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.FILE_DELETED,
        resource: 'file_asset',
        resourceId: asset?.id || key,
        details: { key },
      },
    });
  }

  async getFileAsset(key: string): Promise<FileAssetDto | null> {
    const asset = await this.prisma.fileAsset.findUnique({
      where: { key },
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
