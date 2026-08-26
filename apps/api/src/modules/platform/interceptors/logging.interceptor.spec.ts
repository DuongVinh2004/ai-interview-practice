import { LoggingInterceptor } from './logging.interceptor';
import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('LoggingInterceptor (SEC-008 Redact secret-bearing URLs)', () => {
  let interceptor: LoggingInterceptor;
  let mockLoggerLog: jest.SpyInstance;
  let mockLoggerWarn: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    mockLoggerLog = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    mockLoggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createMockContext(originalUrl: string, method = 'GET'): ExecutionContext {
    const mockRequest: any = {
      method,
      originalUrl,
      ip: '127.0.0.1',
      headers: {},
      get: jest.fn(() => 'TestAgent'),
    };
    const mockResponse: any = {
      statusCode: 200,
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  }

  it('redacts sensitive query parameters such as passcode and token on success', done => {
    const context = createMockContext(
      '/public/share/abc123token?passcode=SecretPass123&token=SensitiveAuth456&page=1',
    );
    const next: CallHandler = {
      handle: () => of({ success: true }),
    };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(mockLoggerLog).toHaveBeenCalled();
        const loggedMessage = mockLoggerLog.mock.calls[0][0];

        expect(loggedMessage).not.toContain('SecretPass123');
        expect(loggedMessage).not.toContain('SensitiveAuth456');
        expect(loggedMessage).toContain('passcode=%5BREDACTED%5D');
        expect(loggedMessage).toContain('/public/share/[REDACTED]');
        done();
      },
    });
  });

  it('redacts sensitive query parameters on error responses', done => {
    const context = createMockContext('/public/share/my-secret-token?passcode=WrongPasscode');
    const next: CallHandler = {
      handle: () => throwError(() => ({ status: 401, message: 'Invalid passcode' })),
    };

    interceptor.intercept(context, next).subscribe({
      error: () => {
        expect(mockLoggerWarn).toHaveBeenCalled();
        const loggedMessage = mockLoggerWarn.mock.calls[0][0];

        expect(loggedMessage).not.toContain('WrongPasscode');
        expect(loggedMessage).not.toContain('my-secret-token');
        expect(loggedMessage).toContain('/public/share/[REDACTED]');
        expect(loggedMessage).toContain('passcode=%5BREDACTED%5D');
        done();
      },
    });
  });

  it('preserves non-sensitive query parameters and path', done => {
    const context = createMockContext('/api/interviews?page=2&limit=10&status=COMPLETED');
    const next: CallHandler = {
      handle: () => of({ items: [] }),
    };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(mockLoggerLog).toHaveBeenCalled();
        const loggedMessage = mockLoggerLog.mock.calls[0][0];

        expect(loggedMessage).toContain('/api/interviews?page=2&limit=10&status=COMPLETED');
        done();
      },
    });
  });
});
