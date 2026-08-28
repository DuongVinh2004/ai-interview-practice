import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: insufficient permissions');
    }

    if (user.tokenType === 'mfa_enrollment') {
      throw new DomainException(
        ErrorCode.MFA_STEP_UP_REQUIRED,
        'MFA enrollment token cannot access role-protected resources. Please complete MFA setup.',
        HttpStatus.FORBIDDEN,
      );
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException('Access denied: requires elevated permissions');
    }

    // Administrators accessing admin-protected endpoints must have verified MFA (SEC-003)
    if (requiredRoles.includes(UserRole.ADMIN) && user.role === UserRole.ADMIN) {
      if (process.env.BYPASS_ADMIN_MFA === 'true') {
        return true;
      }
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.sub || user.id },
        select: { mfaEnabled: true },
      });
      if (!dbUser?.mfaEnabled || !user.mfaVerified) {
        throw new DomainException(
          ErrorCode.MFA_STEP_UP_REQUIRED,
          'Administrator access requires verified multi-factor authentication',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return true;
  }
}
