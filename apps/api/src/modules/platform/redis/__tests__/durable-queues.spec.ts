import { DEFAULT_DURABLE_JOB_OPTIONS } from '../redis.module';

describe('Asynchronous Task Durability & Retry Configuration (AG-PACKET-007 / REL-001)', () => {
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
});
