import { ExecutionContext } from '@nestjs/common';
import { SseTokenSecurityGuard } from './sse-token-security.guard';
import { DomainException } from '../filters/all-exceptions.filter';

describe('SseTokenSecurityGuard (PRD-1102 / SEC-003 SSE Transport Security)', () => {
  let guard: SseTokenSecurityGuard;

  beforeEach(() => {
    guard = new SseTokenSecurityGuard();
  });

  const createMockContext = (req: Partial<any>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as unknown as ExecutionContext;

  it('rejects SSE request when credential is provided in query string (?token=...) with 401', () => {
    const context = createMockContext({
      query: { token: 'sensitive-bearer-token' },
      headers: { authorization: 'Bearer sensitive-bearer-token' },
    });

    expect(() => guard.canActivate(context)).toThrow(DomainException);
    try {
      guard.canActivate(context);
    } catch (err: any) {
      expect(err.status).toBe(401);
      expect(err.message).toContain('Query credentials are not supported for SSE streams');
    }
  });

  it('rejects query parameters matching any known auth key (access_token, authorization, bearer, ticket)', () => {
    const invalidKeys = ['access_token', 'authorization', 'bearer', 'ticket', 'jwt', 'auth'];

    for (const key of invalidKeys) {
      const context = createMockContext({
        query: { [key]: 'secret' },
        headers: { authorization: 'Bearer valid' },
      });

      expect(() => guard.canActivate(context)).toThrow(DomainException);
    }
  });

  it('rejects request when neither Bearer authorization header nor ticket is present and unauthenticated', () => {
    const context = createMockContext({
      query: {},
      headers: {},
    });

    expect(() => guard.canActivate(context)).toThrow(DomainException);
    try {
      guard.canActivate(context);
    } catch (err: any) {
      expect(err.status).toBe(401);
      expect(err.message).toContain('Authentication required for SSE stream');
    }
  });

  it('allows request with valid Authorization: Bearer header and clean query parameters', () => {
    const context = createMockContext({
      query: {},
      headers: { authorization: 'Bearer valid-jwt-token-here' },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows request with x-channel-ticket header and clean query parameters', () => {
    const context = createMockContext({
      query: {},
      headers: { 'x-channel-ticket': 'single-use-ticket-123' },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows request when user is already attached by authentication guard', () => {
    const context = createMockContext({
      query: {},
      headers: {},
      user: { id: 'u-123' },
    });

    expect(guard.canActivate(context)).toBe(true);
  });
});
