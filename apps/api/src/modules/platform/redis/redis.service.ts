import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private subscriberClient!: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string>('redis.password');

    const options = {
      host,
      port,
      password: password || undefined,
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
