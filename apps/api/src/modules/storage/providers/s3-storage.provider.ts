import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider, ObjectMetadata } from '../interfaces/storage-provider.interface';

export function buildS3ClientConfig(
  region: string,
  accessKeyId?: string,
  secretAccessKey?: string,
  sessionToken?: string,
): S3ClientConfig {
  const normalizeCredential = (value: string | undefined, variableName: string) => {
    if (!value) return undefined;
    if (value.trim() !== value) {
      throw new Error(`${variableName} must not contain leading or trailing whitespace`);
    }
    return value;
  };
  const normalizedAccessKeyId = normalizeCredential(accessKeyId, 'AWS_ACCESS_KEY_ID');
  const normalizedSecretAccessKey = normalizeCredential(secretAccessKey, 'AWS_SECRET_ACCESS_KEY');
  const normalizedSessionToken = normalizeCredential(sessionToken, 'AWS_SESSION_TOKEN');
  const hasAccessKeyId = Boolean(normalizedAccessKeyId);
  const hasSecretAccessKey = Boolean(normalizedSecretAccessKey);

  if (hasAccessKeyId !== hasSecretAccessKey) {
    throw new Error(
      'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured together for S3 storage',
    );
  }
  if (normalizedSessionToken && !hasAccessKeyId) {
    throw new Error(
      'AWS_SESSION_TOKEN requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY for S3 storage',
    );
  }

  if (!hasAccessKeyId) {
    return { region };
  }

  return {
    region,
    credentials: {
      accessKeyId: normalizedAccessKeyId!,
      secretAccessKey: normalizedSecretAccessKey!,
      ...(normalizedSessionToken ? { sessionToken: normalizedSessionToken } : {}),
    },
  };
}

@Injectable()
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket =
      this.configService.get<string>('storage.awsS3Bucket') ||
      process.env.AWS_S3_BUCKET ||
      'ai-interview-bucket';
    const region =
      this.configService.get<string>('storage.awsRegion') ||
      process.env.AWS_REGION ||
      'ap-southeast-1';
    const accessKeyId =
      this.configService.get<string>('storage.awsAccessKeyId') || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      this.configService.get<string>('storage.awsSecretAccessKey') ||
      process.env.AWS_SECRET_ACCESS_KEY;
    const sessionToken =
      this.configService.get<string>('storage.awsSessionToken') || process.env.AWS_SESSION_TOKEN;

    this.client = new S3Client(
      buildS3ClientConfig(region, accessKeyId, secretAccessKey, sessionToken),
    );
  }

  async generatePresignedUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
      });
      return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    } catch (error: any) {
      this.logger.error(`Failed to generate S3 presigned upload URL: ${error.message}`);
      throw error;
    }
  }

  async generatePresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    } catch (error: any) {
      this.logger.error(`Failed to generate S3 presigned download URL: ${error.message}`);
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      this.logger.log(`Deleted object from S3: ${key}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete S3 object: ${error.message}`);
      throw error;
    }
  }

  async getObjectMetadata(key: string): Promise<ObjectMetadata | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const response = await this.client.send(command);
      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
      };
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      this.logger.warn(`Failed to get S3 object metadata for ${key}: ${error.message}`);
      return null;
    }
  }
}
