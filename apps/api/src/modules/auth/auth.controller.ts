import { Controller, Post, Get, Body, Req, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  RegisterRequestDto,
  LoginRequestDto,
  RefreshTokenRequestDto,
  ChangePasswordRequestDto,
  MfaEnableRequestDto,
  MfaVerifyRequestDto,
  MfaRecoveryVerifyRequestDto,
  MfaDisableRequestDto,
} from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new candidate account' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  async register(@Body() dto: RegisterRequestDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in to existing account' })
  @ApiResponse({ status: 200, description: 'Login successful (or returns mfaRequired challenge)' })
  async login(@Body() dto: LoginRequestDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    return this.authService.login(dto, ip, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token with refresh token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  async refresh(@Body() dto: RefreshTokenRequestDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out current user session' })
  async logout(@CurrentUser('sub') userId: string, @Body() body?: { refreshToken?: string }) {
    await this.authService.logout(userId, body?.refreshToken);
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
  @ApiOperation({ summary: 'Verify TOTP code and enable 2FA, returning 8 single-use recovery codes' })
  async enableMfa(@CurrentUser('sub') userId: string, @Body() dto: MfaEnableRequestDto) {
    return this.authService.enableMfa(userId, dto.code);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete 2-step login by verifying TOTP 6-digit code' })
  async verifyMfa(@Body() dto: MfaVerifyRequestDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    return this.authService.verifyMfaLogin(dto.mfaSessionToken, dto.code, ip, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('mfa/recovery-verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete 2-step login using a single-use backup recovery code' })
  async verifyRecoveryCode(@Body() dto: MfaRecoveryVerifyRequestDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    return this.authService.verifyRecoveryCodeLogin(
      dto.mfaSessionToken,
      dto.recoveryCode,
      ip,
      userAgent,
    );
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA after password and TOTP/recovery code verification' })
  async disableMfa(@CurrentUser('sub') userId: string, @Body() dto: MfaDisableRequestDto) {
    return this.authService.disableMfa(userId, dto.password, dto.code);
  }
}
