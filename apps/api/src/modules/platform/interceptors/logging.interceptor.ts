import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    request.headers['x-request-id'] = requestId;
    response.setHeader('X-Request-Id', requestId);

    const { method, originalUrl, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          this.logger.log(
            `[${requestId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms - ${ip} - ${userAgent}`,
          );
        },
        error: (err: any) => {
          const duration = Date.now() - startTime;
          const statusCode = err.status || 500;
          this.logger.warn(
            `[${requestId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms - Error: ${err.message}`,
          );
        },
      }),
    );
  }
}
