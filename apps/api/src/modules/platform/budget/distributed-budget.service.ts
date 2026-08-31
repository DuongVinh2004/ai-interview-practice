import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface BudgetReservation {
  key: string;
  reservedMicros: number;
}

@Injectable()
export class DistributedBudgetService {
  private readonly logger = new Logger(DistributedBudgetService.name);

  constructor(private readonly redis: RedisService) {}

  async reserve(
    namespace: string,
    budgetUsd: number,
    amountUsd: number,
  ): Promise<BudgetReservation | null> {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const key = `distributed-budget:${namespace}:${day}`;
    const budgetMicros = this.toMicros(budgetUsd);
    const reservedMicros = this.toMicros(amountUsd);
    const secondsUntilTomorrow = Math.max(
      60,
      Math.ceil(
        (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) /
          1000,
      ) + 3600,
    );

    const result = (await this.redis.getClient().eval(
      `
        local current = tonumber(redis.call('GET', KEYS[1]) or '0')
        local requested = tonumber(ARGV[1])
        local budget = tonumber(ARGV[2])
        if current + requested > budget then
          return {0, current}
        end
        local updated = redis.call('INCRBY', KEYS[1], requested)
        redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
        return {1, updated}
      `,
      1,
      key,
      reservedMicros,
      budgetMicros,
      secondsUntilTomorrow,
    )) as [number, number];

    if (Number(result[0]) !== 1) return null;
    return { key, reservedMicros };
  }

  async settle(reservation: BudgetReservation, actualUsd: number): Promise<void> {
    const actualMicros = this.toMicros(actualUsd);
    const delta = actualMicros - reservation.reservedMicros;
    if (delta === 0) return;

    await this.redis.getClient().eval(
      `
        local current = tonumber(redis.call('GET', KEYS[1]) or '0')
        local updated = math.max(0, current + tonumber(ARGV[1]))
        redis.call('SET', KEYS[1], updated, 'KEEPTTL')
        return updated
      `,
      1,
      reservation.key,
      delta,
    );
  }

  async release(reservation: BudgetReservation): Promise<void> {
    await this.settle(reservation, 0);
  }

  async getCurrentUsd(namespace: string): Promise<number> {
    const day = new Date().toISOString().slice(0, 10);
    const raw = await this.redis.getClient().get(`distributed-budget:${namespace}:${day}`);
    const micros = Number(raw || 0);
    if (!Number.isFinite(micros) || micros < 0) {
      throw new Error('Distributed budget counter is invalid');
    }
    return micros / 1_000_000;
  }

  private toMicros(value: number): number {
    if (!Number.isFinite(value) || value < 0) throw new Error('Budget amount must be non-negative');
    return Math.round(value * 1_000_000);
  }
}
