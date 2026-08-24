import { Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold?: number; // default: 5
  windowMs?: number; // default: 60,000 (60s)
  resetTimeoutMs?: number; // default: 30,000 (30s)
}

interface CircuitStats {
  state: CircuitState;
  failures: number[];
  openedAt: number;
  halfOpenInFlight: boolean;
}

export class CircuitBreakerOpenException extends Error {
  constructor(public readonly provider: string, public readonly operation: string) {
    super(`Circuit breaker is OPEN for provider '${provider}' on operation '${operation}'.`);
    this.name = 'CircuitBreakerOpenException';
  }
}

export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private readonly circuits = new Map<string, CircuitStats>();

  private readonly failureThreshold: number;
  private readonly windowMs: number;
  private readonly resetTimeoutMs: number;

  constructor(config?: CircuitBreakerConfig) {
    this.failureThreshold = config?.failureThreshold ?? 5;
    this.windowMs = config?.windowMs ?? 60_000;
    this.resetTimeoutMs = config?.resetTimeoutMs ?? 30_000;
  }

  private getKey(provider: string, operation: string): string {
    return `${provider}:${operation}`;
  }

  private getCircuit(key: string): CircuitStats {
    let circuit = this.circuits.get(key);
    if (!circuit) {
      circuit = {
        state: CircuitState.CLOSED,
        failures: [],
        openedAt: 0,
        halfOpenInFlight: false,
      };
      this.circuits.set(key, circuit);
    }
    return circuit;
  }

  /**
   * Retrieves the current state of a circuit, transitioning from OPEN to HALF_OPEN if cooldown has expired.
   */
  getState(provider: string, operation: string): CircuitState {
    const key = this.getKey(provider, operation);
    const circuit = this.getCircuit(key);
    const now = Date.now();

    if (circuit.state === CircuitState.OPEN) {
      if (now - circuit.openedAt >= this.resetTimeoutMs) {
        circuit.state = CircuitState.HALF_OPEN;
        circuit.halfOpenInFlight = false;
        this.logger.log(`Circuit for [${key}] transitioned from OPEN to HALF_OPEN (probing recovery)`);
      }
    }

    return circuit.state;
  }

  /**
   * Retrieves all tracked circuit states.
   */
  getAllStates(): Record<string, { state: CircuitState; failureCount: number }> {
    const result: Record<string, { state: CircuitState; failureCount: number }> = {};
    for (const [key, stats] of this.circuits.entries()) {
      const [provider, operation] = key.split(':');
      const state = this.getState(provider, operation);
      result[key] = {
        state,
        failureCount: stats.failures.length,
      };
    }
    return result;
  }


  /**
   * Checks if an execution is allowed.
   */
  canExecute(provider: string, operation: string): boolean {
    const state = this.getState(provider, operation);
    return state === CircuitState.CLOSED || state === CircuitState.HALF_OPEN;
  }

  /**
   * Records a successful execution.
   */
  recordSuccess(provider: string, operation: string): void {
    const key = this.getKey(provider, operation);
    const circuit = this.getCircuit(key);

    if (circuit.state === CircuitState.HALF_OPEN) {
      this.logger.log(`Circuit for [${key}] recovered successfully. Transitioning HALF_OPEN -> CLOSED`);
    }

    circuit.state = CircuitState.CLOSED;
    circuit.failures = [];
    circuit.openedAt = 0;
    circuit.halfOpenInFlight = false;
  }

  /**
   * Records a failure and evaluates whether to trip the circuit to OPEN.
   */
  recordFailure(provider: string, operation: string, error?: Error): void {
    const key = this.getKey(provider, operation);
    const circuit = this.getCircuit(key);
    const now = Date.now();

    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.state = CircuitState.OPEN;
      circuit.openedAt = now;
      circuit.halfOpenInFlight = false;
      this.logger.warn(
        `Probe failed for [${key}] in HALF_OPEN state. Transitioning back to OPEN. Error: ${error?.message}`,
      );
      return;
    }

    // Filter failures within sliding window
    circuit.failures = circuit.failures.filter(timestamp => now - timestamp <= this.windowMs);
    circuit.failures.push(now);

    if (circuit.failures.length >= this.failureThreshold) {
      circuit.state = CircuitState.OPEN;
      circuit.openedAt = now;
      circuit.halfOpenInFlight = false;
      this.logger.error(
        `Circuit tripped to OPEN for [${key}] after ${circuit.failures.length} failures in window. Cooldown: ${this.resetTimeoutMs}ms. Last error: ${error?.message}`,
      );
    }
  }

  /**
   * Executes an async operation protected by the circuit breaker.
   */
  async execute<T>(
    provider: string,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const state = this.getState(provider, operation);
    const key = this.getKey(provider, operation);
    const circuit = this.getCircuit(key);

    if (state === CircuitState.OPEN) {
      throw new CircuitBreakerOpenException(provider, operation);
    }

    if (state === CircuitState.HALF_OPEN) {
      if (circuit.halfOpenInFlight) {
        throw new CircuitBreakerOpenException(provider, operation);
      }
      circuit.halfOpenInFlight = true;
    }

    try {
      const result = await fn();
      this.recordSuccess(provider, operation);
      return result;
    } catch (error: any) {
      this.recordFailure(provider, operation, error);
      throw error;
    }
  }

  /**
   * Manually resets all circuits (useful for testing).
   */
  reset(): void {
    this.circuits.clear();
  }
}
