import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider, ObjectMetadata } from '../interfaces/storage-provider.interface';

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
      this.configService.get<string>('storage.awsAccessKeyId') ||
      process.env.AWS_ACCESS_KEY_ID ||
      'mock-access-key';
    const secretAccessKey =
      this.configService.get<string>('storage.awsSecretAccessKey') ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      'mock-secret-key';

    this.client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
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
