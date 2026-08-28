import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { RedisService } from './redis.service';
import {
  createRedisConnectionOptions,
  calculateExponentialBackoffWithJitter,
} from './redis.options';
import { QueueName } from '@ai-interview/contracts';

export { calculateExponentialBackoffWithJitter };

export const DEFAULT_DURABLE_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    age: 3600, // keep for 1 hour
    count: 500,
  },
  removeOnFail: false, // Retain failed jobs for dead-letter (DLQ) inspection (REL-001)
};

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: createRedisConnectionOptions(configService),
        defaultJobOptions: DEFAULT_DURABLE_JOB_OPTIONS,
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QueueName.QUESTION_GENERATION, defaultJobOptions: DEFAULT_DURABLE_JOB_OPTIONS },
      { name: QueueName.ANSWER_EVALUATION, defaultJobOptions: DEFAULT_DURABLE_JOB_OPTIONS },
      { name: QueueName.LEARNING_PATH, defaultJobOptions: DEFAULT_DURABLE_JOB_OPTIONS },
      { name: QueueName.EMAIL, defaultJobOptions: DEFAULT_DURABLE_JOB_OPTIONS },
    ),
  ],
  providers: [RedisService],
  exports: [RedisService, BullModule],
})
export class RedisModule {}
