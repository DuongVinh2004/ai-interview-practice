import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryService } from './telemetry.service';

describe('TelemetryService', () => {
  let service: TelemetryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TelemetryService],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate valid 32-hex traceId and 16-hex spanId', () => {
    const traceId = service.generateTraceId();
    const spanId = service.generateSpanId();

    expect(traceId).toHaveLength(32);
    expect(spanId).toHaveLength(16);
    expect(/^[0-9a-f]{32}$/.test(traceId)).toBe(true);
    expect(/^[0-9a-f]{16}$/.test(spanId)).toBe(true);
  });

  it('should parse W3C TraceContext traceparent correctly', () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const spanId = '00f067aa0ba902b7';
    const header = `00-${traceId}-${spanId}-01`;

    const parsed = service.parseTraceparent(header);
    expect(parsed).toBeDefined();
    expect(parsed?.traceId).toBe(traceId);
    expect(parsed?.parentSpanId).toBe(spanId);
  });

  it('should create and propagate context through AsyncLocalStorage', () => {
    const ctx = service.createTraceContext({
      'x-request-id': 'req-12345',
    });

    service.runWithContext(ctx, () => {
      const active = service.getCurrentContext();
      expect(active).toBeDefined();
      expect(active?.requestId).toBe('req-12345');
      expect(active?.traceId).toBe(ctx.traceId);

      const headers: Record<string, string> = {};
      service.injectTraceparent(headers);
      expect(headers['X-Trace-Id']).toBe(ctx.traceId);
      expect(headers['traceparent']).toContain(`00-${ctx.traceId}-`);
    });
  });

  it('should execute nested spans with withSpan', async () => {
    const result = await service.withSpan('test-operation', async spanContext => {
      expect(spanContext.traceId).toBeDefined();
      expect(spanContext.spanId).toBeDefined();
      return 'success-value';
    });

    expect(result).toBe('success-value');
  });
});
