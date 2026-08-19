import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SseModule } from './sse/sse.module';
import { HealthModule } from './health/health.module';
import { IdempotencyService } from './guards/idempotency.service';
import { validateEnv } from './config/env.validation';
import { appConfig, dbConfig, redisConfig, jwtConfig, aiConfig } from './config/configuration';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [appConfig, dbConfig, redisConfig, jwtConfig, aiConfig],
    }),
    PrismaModule,
    RedisModule,
    SseModule,
    HealthModule,
  ],
  providers: [IdempotencyService],
  exports: [ConfigModule, PrismaModule, RedisModule, SseModule, HealthModule, IdempotencyService],
})
export class PlatformModule {}
