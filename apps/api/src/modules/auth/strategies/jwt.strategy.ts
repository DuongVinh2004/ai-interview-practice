import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { JwtPayload, UserStatus, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'jwt.accessSecret',
        'dev-access-secret-min-32-chars-ok',
      ),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Reject temporary MFA challenge tokens attempting to access protected routes (B-001)
    if (payload.mfaPending || payload.tokenType === 'mfa_challenge') {
      throw new UnauthorizedException(
        'MFA verification required. Challenge token cannot access protected endpoints.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true, tokenVersion: true },
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

    return {
      sub: user.id,
      email: user.email,
      role: user.role as any,
      status: user.status as any,
      tokenVersion: user.tokenVersion,
      tokenType: 'access',
      mfaVerified: payload.mfaVerified ?? false,
    };
  }
}
