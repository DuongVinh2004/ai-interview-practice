import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ErrorCode, UserRole } from '@ai-interview/contracts';

@Injectable()
export class MfaStepUpGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Step-up: Query actual MFA status from DB (do not trust JWT claim alone)
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { mfaEnabled: true },
    });

    if (!dbUser) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'User not found',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Administrators MUST enable MFA before performing sensitive operations
    if (user.role === UserRole.ADMIN && !dbUser.mfaEnabled) {
      throw new DomainException(
        ErrorCode.MFA_STEP_UP_REQUIRED,
        'Administrators must enable MFA before performing sensitive operations',
        HttpStatus.FORBIDDEN,
      );
    }

    // If MFA is enabled, user must have verified it in the current session
    if (dbUser.mfaEnabled && !user.mfaVerified) {
      throw new DomainException(
        ErrorCode.MFA_STEP_UP_REQUIRED,
        'This sensitive action requires verified multi-factor authentication (Step-Up)',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
