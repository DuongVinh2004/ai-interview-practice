import { Injectable, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  requestId?: string;
  userId?: string;
  startTime: number;
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly storage = new AsyncLocalStorage<TraceContext>();

  /**
   * Generates a 16-byte hex Trace ID (32 hex characters).
   */
  generateTraceId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generates an 8-byte hex Span ID (16 hex characters).
   */
  generateSpanId(): string {
    return randomBytes(8).toString('hex');
  }

  /**
   * Formats a W3C TraceContext traceparent string: `00-${traceId}-${spanId}-01`
   */
  formatTraceparent(traceId: string, spanId: string): string {
    return `00-${traceId}-${spanId}-01`;
  }

  /**
   * Parses incoming W3C traceparent header or returns null if invalid.
   */
  parseTraceparent(traceparent?: string): { traceId: string; parentSpanId: string } | null {
    if (!traceparent) return null;
    const parts = traceparent.trim().split('-');
    if (
      parts.length >= 4 &&
      parts[0] === '00' &&
      parts[1].length === 32 &&
      parts[2].length === 16
    ) {
      return {
        traceId: parts[1],
        parentSpanId: parts[2],
      };
    }
    return null;
  }

  /**
   * Initializes or extracts trace context from headers.
   */
  createTraceContext(
    headers?: Record<string, string | string[] | undefined>,
    requestId?: string,
    userId?: string,
  ): TraceContext {
    const rawTraceparent =
      typeof headers?.['traceparent'] === 'string'
        ? headers['traceparent']
        : typeof headers?.['x-trace-id'] === 'string'
          ? headers['x-trace-id']
          : undefined;

    const parsed = this.parseTraceparent(rawTraceparent);
    const traceId = parsed
      ? parsed.traceId
      : typeof rawTraceparent === 'string' && rawTraceparent.length === 32
        ? rawTraceparent
        : this.generateTraceId();
    const parentSpanId = parsed ? parsed.parentSpanId : undefined;
    const spanId = this.generateSpanId();

    return {
      traceId,
      spanId,
      parentSpanId,
      requestId:
        requestId ||
        (typeof headers?.['x-request-id'] === 'string' ? headers['x-request-id'] : undefined),
      userId,
      startTime: Date.now(),
    };
  }

  /**
   * Runs the given callback within an active AsyncLocalStorage trace context.
   */
  runWithContext<T>(context: TraceContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  /**
   * Retrieves the currently active trace context.
   */
  getCurrentContext(): TraceContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Returns current trace ID or generates a fallback trace ID.
   */
  getTraceId(): string {
    return this.storage.getStore()?.traceId || this.generateTraceId();
  }

  /**
   * Injects current W3C TraceContext headers into an outgoing HTTP header map.
   */
  injectTraceparent(headers: Record<string, string>): Record<string, string> {
    const current = this.getCurrentContext();
    if (current) {
      const childSpanId = this.generateSpanId();
      headers['traceparent'] = this.formatTraceparent(current.traceId, childSpanId);
      headers['X-Trace-Id'] = current.traceId;
      if (current.requestId) {
        headers['X-Request-Id'] = current.requestId;
      }
    }
    return headers;
  }

  /**
   * Executes a nested span and logs latency and error information with trace propagation.
   */
  async withSpan<T>(
    spanName: string,
    operation: (spanContext: TraceContext) => Promise<T>,
  ): Promise<T> {
    const parent = this.getCurrentContext();
    const traceId = parent?.traceId || this.generateTraceId();
    const parentSpanId = parent?.spanId;
    const spanId = this.generateSpanId();

    const spanContext: TraceContext = {
      traceId,
      spanId,
      parentSpanId,
      requestId: parent?.requestId,
      userId: parent?.userId,
      startTime: Date.now(),
    };

    return this.storage.run(spanContext, async () => {
      try {
        const result = await operation(spanContext);
        const duration = Date.now() - spanContext.startTime;
        this.logger.debug(
          `[Span:${spanName}] trace=${traceId} span=${spanId} duration=${duration}ms status=OK`,
        );
        return result;
      } catch (error: any) {
        const duration = Date.now() - spanContext.startTime;
        this.logger.warn(
          `[Span:${spanName}] trace=${traceId} span=${spanId} duration=${duration}ms status=ERROR error=${error.message}`,
        );
        throw error;
      }
    });
  }
}
