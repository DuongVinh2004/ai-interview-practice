import { HttpStatus } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { DomainException } from '../platform/filters/all-exceptions.filter';

describe('AuthController browser session boundary', () => {
  const user = {
    id: '5c0f3c6d-3a84-4da5-b711-b25a761b3f50',
    email: 'candidate@example.com',
    role: 'CANDIDATE',
    status: 'ACTIVE',
    mfaEnabled: false,
    createdAt: new Date().toISOString(),
  };
  let authService: any;
  let config: any;
  let controller: AuthController;
  let response: any;

  beforeEach(() => {
    authService = {
      login: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      logoutBrowserSession: jest.fn(),
    };
    config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'app.nodeEnv') return 'production';
        if (key === 'app.apiPrefix') return '/api/v1';
        if (key === 'app.corsOrigin') return 'https://app.example.com';
        return fallback;
      }),
    };
    response = { cookie: jest.fn(), clearCookie: jest.fn() };
    controller = new AuthController(authService, config);
  });

  const request = (overrides: Record<string, unknown> = {}) =>
    ({
      ip: '127.0.0.1',
      socket: {},
      headers: {},
      get: jest.fn((name: string) => {
        const values: Record<string, string> = {
          origin: 'https://app.example.com',
          'x-csrf-protection': '1',
          'user-agent': 'test-agent',
        };
        return values[name.toLowerCase()];
      }),
      ...overrides,
    }) as any;

  it('sets a hardened cookie and never serializes the raw refresh token', async () => {
    authService.login.mockResolvedValue({
      user,
      accessToken: 'access-token',
      refreshToken: 'raw-refresh-secret',
      expiresIn: 900,
    });

    const result = await controller.login(
      { email: user.email, password: 'ValidPassword1' },
      request(),
      response,
    );

    expect(result).toEqual({ user, accessToken: 'access-token', expiresIn: 900 });
    expect(result).not.toHaveProperty('refreshToken');
    expect(response.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'raw-refresh-secret',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/api/v1/auth',
      }),
    );
  });

  it('rotates only the refresh token supplied by the HttpOnly cookie', async () => {
    authService.refreshTokens.mockResolvedValue({
      user,
      accessToken: 'rotated-access',
      refreshToken: 'rotated-refresh',
      expiresIn: 900,
    });
    const req = request({ headers: { cookie: 'other=x; refresh_token=browser%2Dsecret' } });

    const result = await controller.refresh(req, response);

    expect(authService.refreshTokens).toHaveBeenCalledWith('browser-secret');
    expect(result).not.toHaveProperty('refreshToken');
    expect(response.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'rotated-refresh',
      expect.any(Object),
    );
  });

  it('rejects a cookie-authenticated request without a trusted Origin', async () => {
    const req = request({
      headers: { cookie: 'refresh_token=secret' },
      get: jest.fn((name: string) =>
        name.toLowerCase() === 'x-csrf-protection' ? '1' : undefined,
      ),
    });

    await expect(controller.refresh(req, response)).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    } satisfies Partial<DomainException>);
    expect(authService.refreshTokens).not.toHaveBeenCalled();
  });

  it('revokes the cookie token and clears the browser cookie on logout', async () => {
    const req = request({ headers: { cookie: 'refresh_token=session-secret' } });

    await controller.logout(req, response);

    expect(authService.logoutBrowserSession).toHaveBeenCalledWith('session-secret');
    expect(response.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.objectContaining({ httpOnly: true, secure: true, path: '/api/v1/auth' }),
    );
  });
});
