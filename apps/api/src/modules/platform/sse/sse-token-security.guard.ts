import { CanActivate, ExecutionContext, Injectable, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../filters/all-exceptions.filter';

export const SSE_QUERY_CREDENTIAL_KEYS = new Set([
  'token',
  'access_token',
  'authorization',
  'auth',
  'refresh_token',
  'bearer',
  'ticket',
  'jwt',
]);

@Injectable()
export class SseTokenSecurityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req) return true;

    // Reject query string credentials (PRD-1102 / SEC-003)
    const queryKeys = Object.keys(req.query || {});
    const hasQueryCredential = queryKeys.some(key =>
      SSE_QUERY_CREDENTIAL_KEYS.has(key.toLowerCase()),
    );

    if (hasQueryCredential) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Query credentials are not supported for SSE streams. Pass authentication token or ticket via Authorization: Bearer header.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const authHeader = req.headers ? req.headers['authorization'] : undefined;
    const channelTicket = req.headers ? req.headers['x-channel-ticket'] : undefined;

    const hasBearer = typeof authHeader === 'string' && authHeader.trim().startsWith('Bearer ');
    const hasTicket = typeof channelTicket === 'string' && channelTicket.trim().length > 0;
    const hasUser = Boolean((req as any).user);

    if (hasUser || hasBearer || hasTicket) {
      return true;
    }

    throw new DomainException(
      ErrorCode.UNAUTHORIZED,
      'Authentication required for SSE stream. Use Authorization: Bearer header or x-channel-ticket header.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
