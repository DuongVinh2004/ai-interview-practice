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

    this.subscriberClient.on('connect', () => this.logger.log('Redis subscriber connected'));
    this.subscriberClient.on('error', err =>
      this.logger.error('Redis subscriber error', err.message),
    );
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
    this.assertProductionReady();
    return this.client;
  }

  getSubscriber(): Redis {
    this.assertProductionReady();
    return this.subscriberClient;
  }

  async publish(channel: string, message: unknown): Promise<number> {
    this.assertProductionReady();
    const serialized = typeof message === 'string' ? message : JSON.stringify(message);
    return this.client.publish(channel, serialized);
  }

  /**
   * Returns true if application is configured for production
   */
  isProduction(): boolean {
    const env = (
      this.configService.get<string>('nodeEnv') ||
      this.configService.get<string>('NODE_ENV') ||
      process.env.NODE_ENV ||
      ''
    ).toLowerCase();
    return env === 'production';
  }

  /**
   * Returns true if Redis connection is established and healthy
   */
  isReady(): boolean {
    return Boolean(
      this.client && (this.client.status === 'ready' || this.client.status === 'connect'),
    );
  }

  /**
   * Enforces fail-closed semantics in production: strictly prohibits in-memory fallbacks
   */
  assertProductionReady(): void {
    if (this.isProduction() && !this.isReady()) {
      throw new Error(
        'Redis is unavailable in production environment. In-memory fallback is strictly forbidden (REL-001 / PRD-1002).',
      );
    }
  }
}
