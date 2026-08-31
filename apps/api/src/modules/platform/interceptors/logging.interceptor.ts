import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { MetricsService } from '../metrics/metrics.service';
import { TelemetryService } from '../telemetry/telemetry.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(
    @Optional() private readonly metricsService?: MetricsService,
    @Optional() private readonly telemetryService?: TelemetryService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    request.headers['x-request-id'] = requestId;
    response.setHeader('X-Request-Id', requestId);

    // Distributed Tracing (W3C TraceContext)
    const traceCtx = this.telemetryService?.createTraceContext(
      request.headers as Record<string, string>,
      requestId,
      (request as any).user?.id,
    );

    if (traceCtx && this.telemetryService) {
      response.setHeader('X-Trace-Id', traceCtx.traceId);
      response.setHeader(
        'traceparent',
        this.telemetryService.formatTraceparent(traceCtx.traceId, traceCtx.spanId),
      );
    }

    const { method, originalUrl, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();
    const route = request.route?.path || originalUrl.split('?')[0];
    const safeUrl = this.sanitizeUrl(originalUrl);

    // Active requests metric
    this.metricsService?.httpActiveRequests.inc({ method });

    const handleObservable = next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const durationSeconds = duration / 1000;
          const statusCode = response.statusCode.toString();

          this.metricsService?.httpActiveRequests.dec({ method });
          this.metricsService?.httpRequestsTotal.inc({
            method,
            route,
            status_code: statusCode,
          });
          this.metricsService?.httpRequestDurationSeconds.observe(
            { method, route, status_code: statusCode },
            durationSeconds,
          );

          this.logger.log(
            `[${requestId}] [trace:${traceCtx?.traceId || 'none'}] ${method} ${safeUrl} ${statusCode} - ${duration}ms - ${ip} - ${userAgent}`,
          );
        },
        error: (err: any) => {
          const duration = Date.now() - startTime;
          const durationSeconds = duration / 1000;
          const statusCode = (err.status || 500).toString();

          this.metricsService?.httpActiveRequests.dec({ method });
          this.metricsService?.httpRequestsTotal.inc({
            method,
            route,
            status_code: statusCode,
          });
          this.metricsService?.httpRequestDurationSeconds.observe(
            { method, route, status_code: statusCode },
            durationSeconds,
          );

          this.logger.warn(
            `[${requestId}] [trace:${traceCtx?.traceId || 'none'}] ${method} ${safeUrl} ${statusCode} - ${duration}ms - Error: ${err.message}`,
          );
        },
      }),
    );

    if (traceCtx && this.telemetryService) {
      return new Observable(observer => {
        this.telemetryService!.runWithContext(traceCtx, () => {
          handleObservable.subscribe(observer);
        });
      });
    }

    return handleObservable;
  }

  private sanitizeUrl(url: string): string {
    if (!url) return url;
    try {
      const [path, queryString] = url.split('?');
      let sanitizedPath = path;

      // Redact public share token in path: /public/share/:token
      sanitizedPath = sanitizedPath.replace(
        /\/public\/share\/([a-zA-Z0-9_-]+)/g,
        (match, token) => {
          if (token === 'feedback' || token === 'access') return match;
          return '/public/share/[REDACTED]';
        },
      );

      // SSE / streaming endpoints must never log any query string (PRD-1102 / SEC-003)
      if (sanitizedPath.endsWith('/events') || sanitizedPath.endsWith('/stream')) {
        return sanitizedPath;
      }

      if (!queryString) {
        return sanitizedPath;
      }

      const params = new URLSearchParams(queryString);
      const sensitiveKeys = ['passcode', 'token', 'key', 'secret', 'password', 'authorization', 'auth', 'apiKey', 'api_key'];
      for (const [key] of Array.from(params.entries())) {
        if (
          sensitiveKeys.includes(key.toLowerCase()) ||
          key.toLowerCase().includes('pass') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token')
        ) {
          params.set(key, '[REDACTED]');
        }
      }

      const safeQuery = params.toString();
      return safeQuery ? `${sanitizedPath}?${safeQuery}` : sanitizedPath;
    } catch {
      return url.split('?')[0];
    }
  }
}
