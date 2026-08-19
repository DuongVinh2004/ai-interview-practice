import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface ResponseWrapper<T> {
  success: true;
  data: T;
  meta?: any;
  requestId?: string;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ResponseWrapper<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseWrapper<T> | T> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = (request?.headers?.['x-request-id'] as string) || undefined;

    return next.handle().pipe(
      map(data => {
        // If data is already structured with success: true or is a stream/buffer, return as-is
        if (data && typeof data === 'object' && 'success' in data && data.success === true) {
          return data;
        }

        // If pagination meta is included
        if (data && typeof data === 'object' && 'items' in data && 'meta' in data) {
          return {
            success: true as const,
            data: data.items,
            meta: data.meta,
            ...(requestId ? { requestId } : {}),
            timestamp: new Date().toISOString(),
          };
        }

        return {
          success: true as const,
          data,
          ...(requestId ? { requestId } : {}),
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
