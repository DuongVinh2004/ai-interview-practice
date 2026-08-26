import { ConfigService } from '@nestjs/config';

export function createRedisConnectionOptions(configService: ConfigService) {
  const tls = configService.get<boolean>('redis.tls', false);

  return {
    host: configService.get<string>('redis.host', 'localhost'),
    port: configService.get<number>('redis.port', 6379),
    password: configService.get<string>('redis.password') || undefined,
    tls: tls ? {} : undefined,
  };
}
