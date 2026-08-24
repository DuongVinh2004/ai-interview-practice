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
      // Find the first tenant the user belongs to
      const member = await this.prisma.tenantMember.findFirst({
        where: { userId },
      });
      if (member) {
        req.tenantId = member.tenantId;
        req.tenantRole = member.role;
      }
    }

    next();
  }
}
