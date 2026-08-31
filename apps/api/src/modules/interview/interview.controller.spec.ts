import { HttpStatus } from '@nestjs/common';
import { of } from 'rxjs';
import { UserRole } from '@ai-interview/contracts';
import { InterviewController } from './interview.controller';
import { LoggingInterceptor } from '../platform/interceptors/logging.interceptor';

describe('InterviewController SSE authentication', () => {
  const sessionId = 'session-id';
  const ownerId = 'owner-id';
  const eventStream = of({ data: { type: 'heartbeat' } });
  let authService: { validateAccessToken: jest.Mock };
  let interviewService: {
    assertSessionAccess: jest.Mock;
  };
  let sseService: { getSessionEventStream: jest.Mock };
  let controller: InterviewController;

  beforeEach(() => {
    authService = { validateAccessToken: jest.fn() };
    interviewService = { assertSessionAccess: jest.fn() };
    sseService = { getSessionEventStream: jest.fn().mockReturnValue(eventStream) };
    controller = new InterviewController(
      interviewService as any,
      sseService as any,
      {} as any,
      authService as any,
    );
  });

  function request(authorization?: string, query: Record<string, string> = {}) {
    return {
      headers: authorization ? { authorization } : {},
      query,
    } as any;
  }

  it('rejects a query token without consulting token validation', async () => {
    await expect(
      controller.sseInterviewEvents(sessionId, 'query-token', request()),
    ).rejects.toMatchObject({
      status: HttpStatus.UNAUTHORIZED,
    });
    expect(authService.validateAccessToken).not.toHaveBeenCalled();
  });

  it('rejects a query token even when a valid bearer header is present', async () => {
    await expect(
      controller.sseInterviewEvents(sessionId, 'query-token', request('Bearer header-token')),
    ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
    expect(authService.validateAccessToken).not.toHaveBeenCalled();
  });

  it('rejects alternate query credentials even when a valid bearer header is present', async () => {
    await expect(
      controller.sseInterviewEvents(
        sessionId,
        undefined,
        request('Bearer header-token', { access_token: 'query-token' }),
      ),
    ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
    expect(authService.validateAccessToken).not.toHaveBeenCalled();
  });

  it('authenticates and authorizes a valid bearer header', async () => {
    const payload = {
      sub: ownerId,
      role: UserRole.CANDIDATE,
      mfaVerified: false,
    };
    authService.validateAccessToken.mockResolvedValue(payload);

    await expect(
      controller.sseInterviewEvents(sessionId, undefined, request('Bearer header-token')),
    ).resolves.toBe(eventStream);
    expect(authService.validateAccessToken).toHaveBeenCalledWith('header-token');
    expect(interviewService.assertSessionAccess).toHaveBeenCalledWith(
      ownerId,
      UserRole.CANDIDATE,
      sessionId,
      false,
    );
    expect(sseService.getSessionEventStream).toHaveBeenCalledWith(sessionId);
  });

  it('rejects a missing bearer header', async () => {
    await expect(
      controller.sseInterviewEvents(sessionId, undefined, request()),
    ).rejects.toMatchObject({
      status: HttpStatus.UNAUTHORIZED,
    });
    expect(authService.validateAccessToken).not.toHaveBeenCalled();
  });

  it('delegates wrong-owner denial to session access authorization', async () => {
    const payload = {
      sub: 'other-user-id',
      role: UserRole.CANDIDATE,
      mfaVerified: false,
    };
    authService.validateAccessToken.mockResolvedValue(payload);
    const ownershipError = new Error('session does not belong to user');
    interviewService.assertSessionAccess.mockRejectedValue(ownershipError);

    await expect(
      controller.sseInterviewEvents(sessionId, undefined, request('Bearer header-token')),
    ).rejects.toBe(ownershipError);
    expect(interviewService.assertSessionAccess).toHaveBeenCalledWith(
      'other-user-id',
      UserRole.CANDIDATE,
      sessionId,
      false,
    );
    expect(sseService.getSessionEventStream).not.toHaveBeenCalled();
  });
});

describe('LoggingInterceptor SSE credential redaction', () => {
  it('logs only the URL path and never logs Authorization', () => {
    const interceptor = new LoggingInterceptor();
    const logger = (interceptor as any).logger;
    const logSpy = jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          headers: {
            authorization: 'Bearer secret-header-token',
            'x-request-id': 'request-id',
          },
          originalUrl: '/interviews/session-id/events?token=query-token&state=private',
          ip: '127.0.0.1',
          route: { path: '/interviews/:id/events' },
          get: () => 'test-agent',
        }),
        getResponse: () => ({
          statusCode: HttpStatus.OK,
          setHeader: jest.fn(),
        }),
      }),
    };

    interceptor.intercept(context as any, { handle: () => of({}) } as any).subscribe();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('GET /interviews/session-id/events 200'),
    );
    const logged = logSpy.mock.calls.flat().join(' ');
    expect(logged).not.toContain('?');
    expect(logged).not.toContain('query-token');
    expect(logged).not.toContain('private');
    expect(logged).not.toContain('Authorization');
    expect(logged).not.toContain('secret-header-token');
    logSpy.mockRestore();
  });
});
