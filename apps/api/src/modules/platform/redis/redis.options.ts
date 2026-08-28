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

/**
 * Calculates exponential backoff delay with randomized jitter
 * to prevent thundering herd when AI provider returns rate-limit (429) errors.
 */
export function calculateExponentialBackoffWithJitter(
  attemptsMade: number,
  baseDelay = 1000,
  maxDelay = 30000,
  jitterRatio = 0.25,
): number {
  const safeAttempt = Math.max(1, attemptsMade);
  const exponentialDelay = Math.min(maxDelay, baseDelay * Math.pow(2, safeAttempt - 1));
  const jitterRange = exponentialDelay * jitterRatio;
  const randomJitter = (Math.random() * 2 - 1) * jitterRange;
  return Math.max(Math.floor(baseDelay / 2), Math.round(exponentialDelay + randomJitter));
}
