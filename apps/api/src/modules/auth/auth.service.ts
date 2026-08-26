import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import {
  UserRole,
  UserStatus,
  ErrorCode,
  AuditAction,
  AuthResponse,
  UserDto,
  MfaSetupResponse,
  MfaEnableResponse,
  JwtPayload,
} from '@ai-interview/contracts';
import { RegisterRequestDto, LoginRequestDto, ChangePasswordRequestDto } from './dto/auth.dto';
import { TotpUtil } from './utils/totp.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateAccessToken(token: string): Promise<JwtPayload> {
    if (!token || typeof token !== 'string') {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Authentication token missing or invalid',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const secret =
      this.configService.get<string>('jwt.accessSecret') ||
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'dev-access-secret-min-32-chars-ok';

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, { secret });
    } catch {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Invalid or expired token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (payload.mfaPending || payload.tokenType === 'mfa_challenge') {
      throw new DomainException(
        ErrorCode.MFA_REQUIRED,
        'MFA verification required. Challenge token cannot access protected endpoints.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true, tokenVersion: true },
    });

    if (!user) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'User account no longer exists',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.status === UserStatus.LOCKED) {
      throw new DomainException(
        ErrorCode.USER_LOCKED,
        'Your account has been locked. Please contact support.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (
      payload.tokenVersion !== undefined &&
      user.tokenVersion !== undefined &&
      payload.tokenVersion !== user.tokenVersion
    ) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Session invalidated due to password change or security update',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      sub: user.id,
      id: user.id,
      email: user.email,
      role: user.role as any,
      status: user.status as any,
      tokenVersion: user.tokenVersion,
      tokenType: 'access',
      mfaVerified: payload.mfaVerified ?? false,
    };
  }

  async register(dto: RegisterRequestDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new DomainException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'An account with this email already exists',
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        role: UserRole.CANDIDATE,
        status: UserStatus.ACTIVE,
        profile: {
          create: {
            fullName: dto.fullName.trim(),
          },
        },
      },
      include: {
        profile: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.USER_REGISTERED,
        resource: 'user',
        resourceId: user.id,
      },
    });

    return this.generateAuthResponse(user);
  }

  async login(dto: LoginRequestDto, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { profile: true },
    });

    if (!user) {
      throw new DomainException(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new DomainException(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.status === UserStatus.LOCKED) {
      throw new DomainException(
        ErrorCode.USER_LOCKED,
        'Your account has been locked. Please contact support.',
        HttpStatus.FORBIDDEN,
      );
    }

    // If MFA is enabled, challenge with temporary MFA session token
    if (user.mfaEnabled) {
      const jti = crypto.randomUUID();
      const mfaSessionToken = this.jwtService.sign(
        { sub: user.id, email: user.email, tokenType: 'mfa_challenge', mfaPending: true, jti },
        {
          secret: this.configService.get<string>('jwt.accessSecret'),
          expiresIn: '5m',
        },
      );

      // Store jti for one-time consumption (F-013)
      if (this.prisma.mfaChallenge?.create) {
        await this.prisma.mfaChallenge.create({
          data: {
            jti,
            userId: user.id,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            consumed: false,
          },
        });
      }

      // Opportunistic cleanup of expired MFA challenges (F-013)
      if (this.prisma.mfaChallenge?.deleteMany) {
        this.prisma.mfaChallenge
          .deleteMany({
            where: { expiresAt: { lt: new Date() } },
          })
          .catch(err => this.logger.warn(`Failed to clean expired MFA challenges: ${err.message}`));
      }

      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: AuditAction.USER_LOGGED_IN,
          resource: 'user',
          resourceId: user.id,
          details: { stage: 'MFA_CHALLENGE_REQUIRED' },
          ipAddress,
          userAgent,
        },
      });

      return {
        mfaRequired: true,
        mfaSessionToken,
        expiresIn: 300,
      };
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.USER_LOGGED_IN,
        resource: 'user',
        resourceId: user.id,
        ipAddress,
        userAgent,
      },
    });

    // Enforce: Admin must setup MFA if not yet enabled (SEC-003)
    if (user.role === UserRole.ADMIN && !user.mfaEnabled) {
      const authResponse = await this.generateAuthResponse(user, false);
      return {
        ...authResponse,
        forceMfaSetup: true,
        message:
          'Administrator accounts require MFA setup before accessing administrative features.',
      } as any;
    }

    return this.generateAuthResponse(user);
  }

  async refreshTokens(refreshTokenString: string): Promise<AuthResponse> {
    const tokenHash = this.hashToken(refreshTokenString);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });

    if (!storedToken) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Invalid or expired refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Token reuse / Replay attack detection (family-scoped revocation)
    if (storedToken.isRevoked) {
      this.logger.warn(
        `Token reuse detected for user ${storedToken.userId}, family ${storedToken.familyId}! Invalidating compromised session family.`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { familyId: storedToken.familyId, isRevoked: false },
        data: { isRevoked: true },
      });
      await this.prisma.auditLog.create({
        data: {
          userId: storedToken.userId,
          action: AuditAction.TOKEN_REUSE_DETECTED,
          resource: 'refresh_token',
          resourceId: storedToken.id,
          details: {
            reason: 'Revoked refresh token was presented for rotation',
            familyId: storedToken.familyId,
          },
        },
      });
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Suspicious activity detected. The session family has been revoked.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (storedToken.expiresAt < new Date()) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Refresh token has expired',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (storedToken.user.status === UserStatus.LOCKED) {
      throw new DomainException(
        ErrorCode.USER_LOCKED,
        'Your account has been locked.',
        HttpStatus.FORBIDDEN,
      );
    }

    // Atomic token rotation to prevent race condition replay (H-001)
    const updateResult = await this.prisma.refreshToken.updateMany({
      where: { id: storedToken.id, isRevoked: false },
      data: { isRevoked: true },
    });

    if (updateResult.count === 0) {
      this.logger.warn(
        `Token race/reuse detected for user ${storedToken.userId}, family ${storedToken.familyId}! Invalidating compromised session family.`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { familyId: storedToken.familyId, isRevoked: false },
        data: { isRevoked: true },
      });
      await this.prisma.auditLog.create({
        data: {
          userId: storedToken.userId,
          action: AuditAction.TOKEN_REUSE_DETECTED,
          resource: 'refresh_token',
          resourceId: storedToken.id,
          details: {
            reason: 'Concurrent rotation race or already revoked refresh token',
            familyId: storedToken.familyId,
          },
        },
      });
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Suspicious activity detected. The session family has been revoked.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.generateAuthResponse(storedToken.user, true, storedToken.familyId);
  }

  async logout(userId: string, refreshTokenString?: string): Promise<void> {
    await this.prisma.$transaction(async (tx: any) => {
      if (refreshTokenString) {
        const tokenHash = this.hashToken(refreshTokenString);
        const token = await tx.refreshToken.findUnique({ where: { tokenHash } });
        if (token && token.userId === userId) {
          await tx.refreshToken.updateMany({
            where: { familyId: token.familyId, isRevoked: false },
            data: { isRevoked: true },
          });
        } else {
          await tx.refreshToken.updateMany({
            where: { userId, tokenHash },
            data: { isRevoked: true },
          });
        }
      } else {
        await tx.refreshToken.updateMany({
          where: { userId, isRevoked: false },
          data: { isRevoked: true },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
  }

  async getMe(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.mapToUserDto(user);
  }

  async changePassword(userId: string, dto: ChangePasswordRequestDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new DomainException(
        ErrorCode.INVALID_CREDENTIALS,
        'Current password is incorrect',
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });

    // Revoke all refresh tokens on password change
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  // --- MFA (TOTP & Recovery Codes) Implementation ---

  async setupMfa(userId: string): Promise<MfaSetupResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new DomainException(ErrorCode.RESOURCE_NOT_FOUND, 'User not found');
    }

    if (user.mfaEnabled) {
      throw new DomainException(
        ErrorCode.MFA_ALREADY_ENABLED,
        'MFA is already enabled on this account',
        HttpStatus.CONFLICT,
      );
    }

    const secret = TotpUtil.generateSecret(20);
    const otpauthUrl = TotpUtil.generateOtpAuthUrl(secret, user.email);
    const encryptedSecret = TotpUtil.encryptSecret(secret, this.getMfaEncryptionKey());

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: encryptedSecret },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.MFA_SETUP_INITIATED,
        resource: 'mfa',
        resourceId: userId,
      },
    });

    return {
      secret,
      otpauthUrl,
      issuer: 'AI Interview Practice',
      accountName: user.email,
    };
  }

  async enableMfa(userId: string, code: string): Promise<MfaEnableResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      throw new DomainException(
        ErrorCode.MFA_NOT_ENABLED,
        'Please generate MFA setup secret first',
        HttpStatus.BAD_REQUEST,
      );
    }

    const plainSecret = TotpUtil.decryptSecret(user.mfaSecret, this.getMfaEncryptionKey());
    const isValid = TotpUtil.verifyToken(plainSecret, code);
    if (!isValid) {
      throw new DomainException(
        ErrorCode.MFA_INVALID_CODE,
        'Invalid 6-digit verification code. Please check your authenticator app and system time.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Generate 8 single-use recovery codes
    const plainRecoveryCodes = TotpUtil.generateRecoveryCodes(8);

    // Hash codes before persistence
    const hashedCodes = await Promise.all(
      plainRecoveryCodes.map(async c => ({
        userId,
        codeHash: await bcrypt.hash(c, 10),
        isUsed: false,
      })),
    );

    await this.prisma.$transaction([
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
      this.prisma.recoveryCode.createMany({ data: hashedCodes }),
      this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true, tokenVersion: { increment: 1 } },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: AuditAction.MFA_ENABLED,
          resource: 'mfa',
          resourceId: userId,
          details: { recoveryCodesCount: plainRecoveryCodes.length },
        },
      }),
    ]);

    this.logger.log(`MFA enabled successfully for user ${userId}`);

    return {
      success: true,
      mfaEnabled: true,
      recoveryCodes: plainRecoveryCodes,
      message:
        'Two-factor authentication has been enabled. Please save your recovery backup codes securely.',
    };
  }

  async verifyMfaLogin(
    mfaSessionToken: string,
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    let payload: any;
    try {
      payload = this.jwtService.verify(mfaSessionToken, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new DomainException(
        ErrorCode.MFA_INVALID_SESSION,
        'MFA verification session has expired or is invalid. Please sign in again.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!payload.mfaPending || !payload.sub) {
      throw new DomainException(
        ErrorCode.MFA_INVALID_SESSION,
        'Invalid MFA session token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // One-time consumption check (F-013)
    if (payload.jti && this.prisma.mfaChallenge?.updateMany) {
      const consumed = await this.prisma.mfaChallenge.updateMany({
        where: { jti: payload.jti, consumed: false },
        data: { consumed: true },
      });
      if (consumed.count === 0) {
        throw new DomainException(
          ErrorCode.MFA_INVALID_SESSION,
          'MFA challenge token already used or expired',
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new DomainException(ErrorCode.MFA_NOT_ENABLED, 'MFA is not enabled for this user');
    }

    const plainSecret = TotpUtil.decryptSecret(user.mfaSecret, this.getMfaEncryptionKey());
    const isValid = TotpUtil.verifyToken(plainSecret, code);
    if (!isValid) {
      throw new DomainException(
        ErrorCode.MFA_INVALID_CODE,
        'Invalid 6-digit TOTP code',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.MFA_VERIFIED,
        resource: 'mfa',
        resourceId: user.id,
        ipAddress,
        userAgent,
      },
    });

    return this.generateAuthResponse(user, true);
  }

  async verifyRecoveryCodeLogin(
    mfaSessionToken: string,
    recoveryCode: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    let payload: any;
    try {
      payload = this.jwtService.verify(mfaSessionToken, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new DomainException(
        ErrorCode.MFA_INVALID_SESSION,
        'MFA verification session has expired. Please sign in again.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Validate token type — must be MFA challenge token, not access token (F-013)
    if (!payload.mfaPending || (payload.tokenType && payload.tokenType !== 'mfa_challenge')) {
      throw new DomainException(
        ErrorCode.MFA_INVALID_SESSION,
        'Invalid token type. Recovery requires an MFA challenge token.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // One-time consumption (F-013)
    if (payload.jti && this.prisma.mfaChallenge?.updateMany) {
      const consumed = await this.prisma.mfaChallenge.updateMany({
        where: { jti: payload.jti, consumed: false },
        data: { consumed: true },
      });
      if (consumed.count === 0) {
        throw new DomainException(
          ErrorCode.MFA_INVALID_SESSION,
          'MFA challenge token already used or expired',
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        profile: true,
        recoveryCodes: { where: { isUsed: false } },
      },
    });

    if (!user || !user.mfaEnabled) {
      throw new DomainException(ErrorCode.MFA_NOT_ENABLED, 'MFA is not enabled for this user');
    }

    let matchedCode: any = null;
    const cleanInputCode = recoveryCode.trim().toUpperCase();

    for (const rc of user.recoveryCodes) {
      const isMatch = await bcrypt.compare(cleanInputCode, rc.codeHash);
      if (isMatch) {
        matchedCode = rc;
        break;
      }
    }

    if (!matchedCode) {
      throw new DomainException(
        ErrorCode.MFA_INVALID_CODE,
        'Invalid or already used recovery code',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Mark single-use recovery code as consumed atomically
    const updateResult = await this.prisma.recoveryCode.updateMany({
      where: { id: matchedCode.id, isUsed: false },
      data: { isUsed: true, usedAt: new Date() },
    });

    if (updateResult.count === 0) {
      throw new DomainException(
        ErrorCode.MFA_INVALID_CODE,
        'Invalid or already used recovery code',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.MFA_RECOVERY_USED,
        resource: 'recovery_code',
        resourceId: matchedCode.id,
        ipAddress,
        userAgent,
      },
    });

    this.logger.warn(`Single-use recovery code consumed for user ${user.id}`);

    return this.generateAuthResponse(user, true);
  }

  async disableMfa(
    userId: string,
    password: string,
    code: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { recoveryCodes: { where: { isUsed: false } } },
    });

    if (!user) {
      throw new DomainException(ErrorCode.RESOURCE_NOT_FOUND, 'User not found');
    }

    if (!user.mfaEnabled) {
      throw new DomainException(ErrorCode.MFA_NOT_ENABLED, 'MFA is not currently enabled');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new DomainException(
        ErrorCode.INVALID_CREDENTIALS,
        'Password is incorrect',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify either TOTP code or an unused recovery code
    let isCodeValid = false;
    if (user.mfaSecret) {
      const plainSecret = TotpUtil.decryptSecret(user.mfaSecret, this.getMfaEncryptionKey());
      isCodeValid = TotpUtil.verifyToken(plainSecret, code);
    }

    if (!isCodeValid) {
      const cleanCode = code.trim().toUpperCase();
      for (const rc of user.recoveryCodes) {
        if (await bcrypt.compare(cleanCode, rc.codeHash)) {
          isCodeValid = true;
          break;
        }
      }
    }

    if (!isCodeValid) {
      throw new DomainException(
        ErrorCode.MFA_INVALID_CODE,
        'Invalid authentication code or recovery code',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: false, mfaSecret: null },
      }),
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: AuditAction.MFA_DISABLED,
          resource: 'mfa',
          resourceId: userId,
        },
      }),
    ]);

    this.logger.log(`MFA disabled for user ${userId}`);

    return {
      success: true,
      message: 'Two-factor authentication has been disabled for your account.',
    };
  }

  private getMfaEncryptionKey(): string {
    const key = this.configService.get<string>('MFA_ENCRYPTION_KEY');
    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: MFA_ENCRYPTION_KEY must be configured in production');
      }
      return (
        this.configService.get<string>('jwt.accessSecret') ||
        'dev-mfa-encryption-fallback-key-32-chars-min'
      );
    }
    return key;
  }

  private async generateAuthResponse(
    user: any,
    mfaVerified = false,
    familyId?: string,
  ): Promise<AuthResponse> {
    const isMfaActive = user.mfaEnabled || false;
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      tokenType: 'access',
      tokenVersion: user.tokenVersion || 0,
      mfaVerified: mfaVerified,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m') as any,
    });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    const refreshDays = 7;
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);
    const tokenFamilyId = familyId || crypto.randomUUID();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId: tokenFamilyId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      user: this.mapToUserDto(user),
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 15 * 60, // seconds
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private mapToUserDto(user: any): UserDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      mfaEnabled: user.mfaEnabled || false,
      createdAt: user.createdAt.toISOString(),
      profile: user.profile
        ? {
            id: user.profile.id,
            fullName: user.profile.fullName,
            targetRole: user.profile.targetRole,
            targetLevel: user.profile.targetLevel,
            bio: user.profile.bio,
          }
        : null,
    };
  }
}
