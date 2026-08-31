import { Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ErrorCode } from '@ai-interview/contracts';
import { AuthService } from './auth.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  RegisterRequestDto,
  LoginRequestDto,
  ChangePasswordRequestDto,
  MfaEnableRequestDto,
  MfaVerifyRequestDto,
  MfaRecoveryVerifyRequestDto,
  MfaDisableRequestDto,
} from './dto/auth.dto';

const refreshThrottleLimit = Number(process.env.AUTH_REFRESH_THROTTLE_LIMIT || 60);

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly refreshCookieName = 'refresh_token';

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new candidate account' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  async register(
    @Body() dto: RegisterRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertTrustedBrowserRequest(req, false);
    return this.finalizeAuthResponse(await this.authService.register(dto), res);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in to existing account' })
  @ApiResponse({ status: 200, description: 'Login successful (or returns mfaRequired challenge)' })
  async login(
    @Body() dto: LoginRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertTrustedBrowserRequest(req, false);
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    return this.finalizeAuthResponse(await this.authService.login(dto, ip, userAgent), res);
  }

  @Public()
  // Refresh requires a high-entropy HttpOnly cookie and performs one-time token rotation.
  // Keep enough headroom for legitimate users sharing a corporate/school NAT address.
  @Throttle({ default: { limit: refreshThrottleLimit, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token with the HttpOnly refresh cookie' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertTrustedBrowserRequest(req, true);
    const refreshToken = this.readCookie(req, this.refreshCookieName);
    if (!refreshToken) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Refresh session is missing',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return this.finalizeAuthResponse(await this.authService.refreshTokens(refreshToken), res);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out current user session' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertTrustedBrowserRequest(req, true);
    const refreshToken = this.readCookie(req, this.refreshCookieName);
    if (refreshToken) await this.authService.logoutBrowserSession(refreshToken);
    this.clearRefreshCookie(res);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getMe(@CurrentUser('sub') userId: string) {
    return this.authService.getMe(userId);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current user password' })
  async changePassword(@CurrentUser('sub') userId: string, @Body() dto: ChangePasswordRequestDto) {
    await this.authService.changePassword(userId, dto);
    return { message: 'Password changed successfully' };
  }

  // --- MFA (TOTP 2FA & Recovery Codes) Endpoints ---

  @Post('mfa/setup')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate TOTP secret and otpauth URI for 2FA setup' })
  async setupMfa(@CurrentUser('sub') userId: string) {
    return this.authService.setupMfa(userId);
  }

  @Post('mfa/enable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify TOTP code and enable 2FA, returning 8 single-use recovery codes',
  })
  async enableMfa(
    @CurrentUser('sub') userId: string,
    @Body() dto: MfaEnableRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertTrustedBrowserRequest(req, true);
    return this.finalizeAuthResponse(await this.authService.enableMfa(userId, dto.code), res);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete 2-step login by verifying TOTP 6-digit code' })
  async verifyMfa(
    @Body() dto: MfaVerifyRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertTrustedBrowserRequest(req, false);
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    return this.finalizeAuthResponse(
      await this.authService.verifyMfaLogin(dto.mfaSessionToken, dto.code, ip, userAgent),
      res,
    );
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('mfa/recovery-verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete 2-step login using a single-use backup recovery code' })
  async verifyRecoveryCode(
    @Body() dto: MfaRecoveryVerifyRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertTrustedBrowserRequest(req, false);
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    return this.finalizeAuthResponse(
      await this.authService.verifyRecoveryCodeLogin(
        dto.mfaSessionToken,
        dto.recoveryCode,
        ip,
        userAgent,
      ),
      res,
    );
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA after password and TOTP/recovery code verification' })
  async disableMfa(@CurrentUser('sub') userId: string, @Body() dto: MfaDisableRequestDto) {
    return this.authService.disableMfa(userId, dto.password, dto.code);
  }

  private finalizeAuthResponse<T extends Record<string, unknown>>(result: T, res: Response) {
    const { refreshToken, ...publicResponse } = result as T & { refreshToken?: unknown };
    if (typeof refreshToken === 'string' && refreshToken.length > 0) {
      res.cookie(this.refreshCookieName, refreshToken, this.refreshCookieOptions());
    }
    return publicResponse;
  }

  private refreshCookieOptions() {
    const apiPrefix = this.configService.get<string>('app.apiPrefix', '/api/v1');
    return {
      httpOnly: true,
      secure: this.configService.get<string>('app.nodeEnv', 'development') === 'production',
      sameSite: 'lax' as const,
      path: `${apiPrefix.replace(/\/$/, '')}/auth`,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  private clearRefreshCookie(res: Response) {
    const { maxAge: _maxAge, ...options } = this.refreshCookieOptions();
    res.clearCookie(this.refreshCookieName, options);
  }

  private readCookie(req: Request, name: string): string | undefined {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return undefined;

    for (const part of cookieHeader.split(';')) {
      const separator = part.indexOf('=');
      if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private assertTrustedBrowserRequest(req: Request, cookieRequired: boolean) {
    if (this.configService.get<string>('app.nodeEnv', 'development') !== 'production') return;

    const csrfHeader = req.get('x-csrf-protection');
    const origin = req.get('origin');
    const allowedOrigins = this.configService
      .get<string>('app.corsOrigin', '')
      .split(',')
      .map(value => value.trim())
      .filter(value => value.length > 0 && value !== '*');

    const invalidHeader = csrfHeader !== '1';
    const invalidOrigin = Boolean(origin) && !allowedOrigins.includes(origin as string);
    const missingCookieOrigin = cookieRequired && !origin;
    if (invalidHeader || invalidOrigin || missingCookieOrigin) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Cross-site request rejected',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
