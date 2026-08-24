import { CircuitBreaker, CircuitState, CircuitBreakerOpenException } from './circuit-breaker';

describe('CircuitBreaker Resilience Spec', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      windowMs: 5000,
      resetTimeoutMs: 200, // short cooldown for tests
    });
  });

  it('starts in CLOSED state and allows execution', async () => {
    const state = circuitBreaker.getState('test-provider', 'eval');
    expect(state).toBe(CircuitState.CLOSED);
    expect(circuitBreaker.canExecute('test-provider', 'eval')).toBe(true);

    const result = await circuitBreaker.execute('test-provider', 'eval', async () => 'ok');
    expect(result).toBe('ok');
  });

  it('transitions from CLOSED to OPEN after consecutive failures meet threshold', async () => {
    const failingFn = jest.fn().mockRejectedValue(new Error('API 500'));

    for (let i = 0; i < 2; i++) {
      await expect(circuitBreaker.execute('test-provider', 'eval', failingFn)).rejects.toThrow('API 500');
      expect(circuitBreaker.getState('test-provider', 'eval')).toBe(CircuitState.CLOSED);
    }

    // 3rd failure trips threshold
    await expect(circuitBreaker.execute('test-provider', 'eval', failingFn)).rejects.toThrow('API 500');
    expect(circuitBreaker.getState('test-provider', 'eval')).toBe(CircuitState.OPEN);
    expect(circuitBreaker.canExecute('test-provider', 'eval')).toBe(false);

    // Subsequent call should fast-fail with CircuitBreakerOpenException
    await expect(circuitBreaker.execute('test-provider', 'eval', failingFn)).rejects.toThrow(
      CircuitBreakerOpenException,
    );
  });

  it('transitions from OPEN to HALF_OPEN after cooldown and resets to CLOSED on probe success', async () => {
    const failingFn = jest.fn().mockRejectedValue(new Error('API 500'));
    for (let i = 0; i < 3; i++) {
      await expect(circuitBreaker.execute('test-provider', 'eval', failingFn)).rejects.toThrow();
    }
    expect(circuitBreaker.getState('test-provider', 'eval')).toBe(CircuitState.OPEN);

    // Wait for cooldown
    await new Promise(resolve => setTimeout(resolve, 250));

    expect(circuitBreaker.getState('test-provider', 'eval')).toBe(CircuitState.HALF_OPEN);
    expect(circuitBreaker.canExecute('test-provider', 'eval')).toBe(true);

    // Probe success
    const probeResult = await circuitBreaker.execute('test-provider', 'eval', async () => 'probe-ok');
    expect(probeResult).toBe('probe-ok');
    expect(circuitBreaker.getState('test-provider', 'eval')).toBe(CircuitState.CLOSED);
  });

  it('re-opens circuit if probe fails during HALF_OPEN', async () => {
    const failingFn = jest.fn().mockRejectedValue(new Error('API 500'));
    for (let i = 0; i < 3; i++) {
      await expect(circuitBreaker.execute('test-provider', 'eval', failingFn)).rejects.toThrow();
    }

    await new Promise(resolve => setTimeout(resolve, 250));
    expect(circuitBreaker.getState('test-provider', 'eval')).toBe(CircuitState.HALF_OPEN);

    // Probe failure
    await expect(circuitBreaker.execute('test-provider', 'eval', failingFn)).rejects.toThrow('API 500');
    expect(circuitBreaker.getState('test-provider', 'eval')).toBe(CircuitState.OPEN);
  });
});
