import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SseModule } from './sse/sse.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { IdempotencyService } from './guards/idempotency.service';
import { validateEnv } from './config/env.validation';
import {
  appConfig,
  dbConfig,
  redisConfig,
  jwtConfig,
  aiConfig,
  featuresConfig,
  storageConfig,
  emailConfig,
  billingConfig,
  voiceConfig,
  visionConfig,
} from './config/configuration';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [
        appConfig,
        dbConfig,
        redisConfig,
        jwtConfig,
        aiConfig,
        featuresConfig,
        storageConfig,
        emailConfig,
        billingConfig,
        voiceConfig,
        visionConfig,
      ],
    }),
    PrismaModule,
    RedisModule,
    SseModule,
    HealthModule,
    MetricsModule,
    TelemetryModule,
  ],
  providers: [IdempotencyService],
  exports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    SseModule,
    HealthModule,
    MetricsModule,
    TelemetryModule,
    IdempotencyService,
  ],
})
export class PlatformModule {}
