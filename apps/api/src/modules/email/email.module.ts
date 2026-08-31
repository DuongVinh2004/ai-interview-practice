import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from '@ai-interview/contracts';
import { PlatformModule } from '../platform/platform.module';
import { DEFAULT_DURABLE_JOB_OPTIONS } from '../platform/redis/redis.module';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { MockEmailProvider } from './providers/mock-email.provider';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { EmailEventsListener } from './listeners/email-events.listener';
import { isWorkerProcess } from '../platform/process-role';

@Module({
  imports: [
    PlatformModule,
    ConfigModule,
    BullModule.registerQueue({
      name: QueueName.EMAIL,
      defaultJobOptions: DEFAULT_DURABLE_JOB_OPTIONS,
    }),
  ],
  providers: [
    ResendEmailProvider,
    MockEmailProvider,
    {
      provide: 'EMAIL_PROVIDER',
      useFactory: (
        configService: ConfigService,
        resendProvider: ResendEmailProvider,
        mockProvider: MockEmailProvider,
      ) => {
        const providerName =
          configService.get<string>('email.provider') || process.env.EMAIL_PROVIDER || 'mock';
        const resendKey =
          configService.get<string>('email.resendApiKey') || process.env.RESEND_API_KEY;

        if (providerName.toLowerCase() === 'resend' && resendKey && !resendKey.includes('mock')) {
          return resendProvider;
        }
        return mockProvider;
      },
      inject: [ConfigService, ResendEmailProvider, MockEmailProvider],
    },
    EmailService,
    EmailEventsListener,
    ...(isWorkerProcess() ? [EmailProcessor] : []),
  ],
  exports: [EmailService, 'EMAIL_PROVIDER'],
})
export class EmailModule {}
