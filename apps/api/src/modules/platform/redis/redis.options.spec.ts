import { ConfigService } from '@nestjs/config';
import { createRedisConnectionOptions } from './redis.options';

describe('createRedisConnectionOptions', () => {
  it('enables TLS consistently for encrypted Redis deployments', () => {
    const values: Record<string, unknown> = {
      'redis.host': 'encrypted-cache.internal',
      'redis.port': 6379,
      'redis.password': 'configured-value',
      'redis.tls': true,
    };
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
    } as unknown as ConfigService;

    expect(createRedisConnectionOptions(configService)).toEqual({
      host: 'encrypted-cache.internal',
      port: 6379,
      password: 'configured-value',
      tls: {},
    });
  });

  it('leaves TLS disabled for local development by default', () => {
    const configService = {
      get: jest.fn((_key: string, fallback?: unknown) => fallback),
    } as unknown as ConfigService;

    expect(createRedisConnectionOptions(configService)).toEqual({
      host: 'localhost',
      port: 6379,
      password: undefined,
      tls: undefined,
    });
  });
});
