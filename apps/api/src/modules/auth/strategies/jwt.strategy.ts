import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { JwtPayload, UserRole, UserStatus, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey: configService.get<string>(
        'jwt.accessSecret',
        'dev-access-secret-min-32-chars-ok',
      ),
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<JwtPayload> {
    const tokenType = payload.tokenType as string | undefined;

    // Reject temporary MFA challenge tokens attempting to access protected routes (B-001)
    if (tokenType !== undefined && tokenType !== 'access' && tokenType !== 'mfa_enrollment') {
      throw new UnauthorizedException(
        'Only access or enrollment tokens can authenticate HTTP endpoints.',
      );
    }

    // Enrollment tokens can only access the two endpoints required to complete enrollment.
    if (tokenType === 'mfa_enrollment') {
      const requestPath = (req.originalUrl || req.path || '').split('?')[0];
      const isEnrollmentEndpoint =
        req.method === 'POST' && /\/auth\/mfa\/(setup|enable)\/?$/.test(requestPath);
      if (!isEnrollmentEndpoint) {
        throw new UnauthorizedException(
          'MFA enrollment required. Please complete MFA setup before accessing this resource.',
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        tokenVersion: true,
        mfaEnabled: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User account no longer exists');
    }

    if (user.status === UserStatus.LOCKED) {
      throw new DomainException(
        ErrorCode.USER_LOCKED,
        'Your account has been locked. Please contact support.',
        403,
      );
    }

    // Reject tokens if password or credentials were changed (M-003)
    if (
      payload.tokenVersion !== undefined &&
      user.tokenVersion !== undefined &&
      payload.tokenVersion !== user.tokenVersion
    ) {
      throw new UnauthorizedException(
        'Session invalidated due to password change or security update',
      );
    }

    const isEnrollmentToken = tokenType === 'mfa_enrollment';
    if (
      user.role === UserRole.ADMIN &&
      ((!isEnrollmentToken && (!user.mfaEnabled || payload.mfaVerified !== true)) ||
        (isEnrollmentToken && user.mfaEnabled))
    ) {
      throw new UnauthorizedException(
        'Administrator session requires verified multi-factor authentication',
      );
    }

    return {
      sub: user.id,
      id: user.id,
      email: user.email,
      role: user.role as any,
      status: user.status as any,
      tokenVersion: user.tokenVersion,
      tokenType: payload.tokenType || 'access',
      mfaVerified: user.mfaEnabled && (payload.mfaVerified ?? false),
    };
  }
}
