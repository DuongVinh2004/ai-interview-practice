import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../platform/prisma/prisma.service';

export interface RequestWithTenant extends Request {
  tenantId?: string;
  tenantRole?: string;
  user?: any;
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: RequestWithTenant, res: Response, next: NextFunction) {
    const tenantIdHeader = req.headers['x-tenant-id'] as string;
    const userId = req.user?.sub || req.user?.id;

    if (tenantIdHeader) {
      req.tenantId = tenantIdHeader;
      if (userId) {
        const member = await this.prisma.tenantMember.findUnique({
          where: {
            tenantId_userId: {
              tenantId: tenantIdHeader,
              userId,
            },
          },
        });
        if (member) {
          req.tenantRole = member.role;
        }
      }
    } else if (userId) {
      // Fail closed: require explicit tenant selection for multi-tenant users
      const memberCount = await this.prisma.tenantMember.count({ where: { userId } });
      if (memberCount === 1) {
        // Single tenant: auto-resolve (unambiguous)
        const member = await this.prisma.tenantMember.findFirst({ where: { userId } });
        if (member) {
          req.tenantId = member.tenantId;
          req.tenantRole = member.role;
        }
      }
      // memberCount === 0: no tenant context (non-B2B user)
      // memberCount > 1: no auto-select, require explicit x-tenant-id header
    }

    next();
  }
}
