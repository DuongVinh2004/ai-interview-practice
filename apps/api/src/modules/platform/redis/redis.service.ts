import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createRedisConnectionOptions } from './redis.options';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private subscriberClient!: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const options = {
      ...createRedisConnectionOptions(this.configService),
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy(times: number) {
        return Math.min(times * 50, 2000);
      },
    };

    this.client = new Redis(options);
    this.subscriberClient = new Redis(options);

    this.client.on('connect', () => this.logger.log('Redis client connected'));
    this.client.on('error', err => this.logger.error('Redis error', err.message));
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
    if (this.subscriberClient) {
      await this.subscriberClient.quit();
    }
    this.logger.log('Redis disconnected');
  }

  getClient(): Redis {
    return this.client;
  }

  getSubscriber(): Redis {
    return this.subscriberClient;
  }

  async publish(channel: string, message: unknown): Promise<number> {
    const serialized = typeof message === 'string' ? message : JSON.stringify(message);
    return this.client.publish(channel, serialized);
  }
}
