import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantRole, UserRole } from '@ai-interview/contracts';
import { PrismaService } from '../../platform/prisma/prisma.service';

export const TENANT_ROLES_KEY = 'tenant_roles';
export const RequireTenantRoles = (...roles: TenantRole[]) => SetMetadata(TENANT_ROLES_KEY, roles);

@Injectable()
export class TenantRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<TenantRole[]>(TENANT_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = request.tenantId || request.headers['x-tenant-id'] || request.params.tenantId;

    if (!user) {
      throw new ForbiddenException('User authentication required for tenant operations');
    }

    // SuperAdmin bypasses tenant role guard
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    if (!tenantId) {
      throw new ForbiddenException(
        'Explicit tenant context (x-tenant-id header or route param) is required for tenant-scoped operations',
      );
    }

    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: user.sub || user.id,
        },
      },
    });

    if (!membership || !requiredRoles.includes(membership.role as TenantRole)) {
      throw new ForbiddenException('You do not have required permissions within this organization');
    }

    request.tenantRole = membership.role;
    return true;
  }
}
