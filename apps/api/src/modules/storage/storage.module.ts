import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { R2StorageProvider } from './providers/r2-storage.provider';
import { MockStorageProvider } from './providers/mock-storage.provider';
import { PlatformModule } from '../platform/platform.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PlatformModule, AuthModule, ConfigModule],
  controllers: [StorageController],
  providers: [
    S3StorageProvider,
    R2StorageProvider,
    MockStorageProvider,
    {
      provide: 'STORAGE_PROVIDER',
      useFactory: (
        configService: ConfigService,
        s3Provider: S3StorageProvider,
        r2Provider: R2StorageProvider,
        mockProvider: MockStorageProvider,
      ) => {
        const providerName =
          configService.get<string>('storage.provider') || process.env.STORAGE_PROVIDER || 'mock';

        if (providerName.toLowerCase() === 's3') {
          return s3Provider;
        }
        if (providerName.toLowerCase() === 'r2') {
          return r2Provider;
        }
        return mockProvider;
      },
      inject: [ConfigService, S3StorageProvider, R2StorageProvider, MockStorageProvider],
    },
    StorageService,
  ],
  exports: [StorageService, 'STORAGE_PROVIDER'],
})
export class StorageModule {}
