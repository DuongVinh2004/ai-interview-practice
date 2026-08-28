import {
  DEFAULT_DURABLE_JOB_OPTIONS,
  calculateExponentialBackoffWithJitter,
} from '../redis.module';

describe('Asynchronous Task Durability & Retry Configuration (AG-PACKET-007 / REL-001 / NEW-PERF-01)', () => {
  it('configures at least 3 retry attempts for background job queues', () => {
    expect(DEFAULT_DURABLE_JOB_OPTIONS.attempts).toBeGreaterThanOrEqual(3);
  });

  it('configures exponential backoff delay for retries', () => {
    expect(DEFAULT_DURABLE_JOB_OPTIONS.backoff.type).toBe('exponential');
    expect(DEFAULT_DURABLE_JOB_OPTIONS.backoff.delay).toBeGreaterThanOrEqual(1000);
  });

  it('retains failed jobs for dead-letter analysis (removeOnFail is false)', () => {
    expect(DEFAULT_DURABLE_JOB_OPTIONS.removeOnFail).toBe(false);
  });

  describe('calculateExponentialBackoffWithJitter', () => {
    it('calculates exponential delay with jitter for subsequent retry attempts', () => {
      const attempt1 = calculateExponentialBackoffWithJitter(1, 1000, 30000, 0.2);
      const attempt2 = calculateExponentialBackoffWithJitter(2, 1000, 30000, 0.2);
      const attempt3 = calculateExponentialBackoffWithJitter(3, 1000, 30000, 0.2);

      // Attempt 1: ~1000ms (+- 20%) -> 800 - 1200ms
      expect(attempt1).toBeGreaterThanOrEqual(800);
      expect(attempt1).toBeLessThanOrEqual(1200);

      // Attempt 2: ~2000ms (+- 20%) -> 1600 - 2400ms
      expect(attempt2).toBeGreaterThanOrEqual(1600);
      expect(attempt2).toBeLessThanOrEqual(2400);

      // Attempt 3: ~4000ms (+- 20%) -> 3200 - 4800ms
      expect(attempt3).toBeGreaterThanOrEqual(3200);
      expect(attempt3).toBeLessThanOrEqual(4800);
    });

    it('respects maxDelay cap when attempts are large', () => {
      const largeAttempt = calculateExponentialBackoffWithJitter(10, 1000, 15000, 0.1);
      // Base capped at 15000ms with +- 10% jitter -> max 16500
      expect(largeAttempt).toBeLessThanOrEqual(16500);
    });

    it('handles negative or zero attempt values gracefully', () => {
      const zeroAttempt = calculateExponentialBackoffWithJitter(0, 1000, 30000, 0.2);
      expect(zeroAttempt).toBeGreaterThanOrEqual(500);
      expect(zeroAttempt).toBeLessThanOrEqual(1200);
    });
  });
});
