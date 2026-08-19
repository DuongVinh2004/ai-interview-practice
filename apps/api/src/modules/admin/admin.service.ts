import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { UserRole, UserStatus, ErrorCode, AuditAction } from '@ai-interview/contracts';

export interface AdminUserQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listUsers(options: AdminUserQueryOptions) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.role) {
      where.role = options.role;
    }
    if (options.status) {
      where.status = options.status;
    }
    if (options.search) {
      const query = options.search.trim();
      where.OR = [
        { email: { contains: query, mode: 'insensitive' } },
        { profile: { fullName: { contains: query, mode: 'insensitive' } } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          lockedAt: true,
          lockReason: true,
          createdAt: true,
          profile: {
            select: {
              id: true,
              fullName: true,
              targetRole: true,
              targetLevel: true,
            },
          },
          _count: {
            select: { sessions: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        status: u.status,
        lockedAt: u.lockedAt?.toISOString() || null,
        lockReason: u.lockReason,
        createdAt: u.createdAt.toISOString(),
        profile: u.profile,
        sessionCount: u._count.sessions,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async lockUser(adminId: string, targetUserId: string, reason?: string) {
    if (adminId === targetUserId) {
      throw new DomainException(
        ErrorCode.SELF_LOCK_FORBIDDEN,
        'Administrators cannot lock their own account',
        HttpStatus.BAD_REQUEST,
      );
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        status: UserStatus.LOCKED,
        lockedAt: new Date(),
        lockReason: reason || 'Locked by administrator',
      },
    });

    // Revoke all active refresh tokens for the locked user
    await this.prisma.refreshToken.updateMany({
      where: { userId: targetUserId, isRevoked: false },
      data: { isRevoked: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: AuditAction.USER_LOCKED,
        resource: 'user',
        resourceId: targetUserId,
        details: { reason },
      },
    });

    this.logger.log(`User ${targetUserId} was soft-locked by admin ${adminId}`);

    return {
      id: updated.id,
      email: updated.email,
      status: updated.status,
      lockedAt: updated.lockedAt?.toISOString(),
      lockReason: updated.lockReason,
    };
  }

  async unlockUser(adminId: string, targetUserId: string) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        status: UserStatus.ACTIVE,
        lockedAt: null,
        lockReason: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: AuditAction.USER_UNLOCKED,
        resource: 'user',
        resourceId: targetUserId,
      },
    });

    this.logger.log(`User ${targetUserId} was unlocked by admin ${adminId}`);

    return {
      id: updated.id,
      email: updated.email,
      status: updated.status,
    };
  }
}
