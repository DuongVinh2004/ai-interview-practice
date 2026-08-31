import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { UserRole, UserStatus, ErrorCode, AuditAction, AiRunStatus } from '@ai-interview/contracts';
import { ProviderRouterService } from '../ai-orchestrator/router/provider-router.service';
import { SemanticCacheService } from '../ai-orchestrator/cache/semantic-cache.service';

export interface AdminUserQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface AdminAiRunQueryOptions {
  page?: number;
  limit?: number;
  provider?: string;
  status?: AiRunStatus;
  sessionId?: string;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRouter: ProviderRouterService,
    private readonly semanticCache: SemanticCacheService,
  ) {}

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

  async listAiRuns(options: AdminAiRunQueryOptions) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.provider) {
      where.provider = options.provider;
    }
    if (options.status) {
      where.status = options.status;
    }
    if (options.sessionId) {
      where.sessionId = options.sessionId;
    }

    const [total, runs] = await Promise.all([
      this.prisma.aiRun.count({ where }),
      this.prisma.aiRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          promptVersion: {
            select: {
              slug: true,
              version: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: runs.map(r => ({
        id: r.id,
        sessionId: r.sessionId,
        promptSlug: r.promptVersion?.slug || 'unknown',
        promptVersion: r.promptVersion?.version || 1,
        provider: r.provider,
        model: r.model,
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        totalTokens: r.totalTokens,
        latencyMs: r.latencyMs,
        costEstimate: r.costEstimate,
        status: r.status,
        metadata: r.metadata,
        createdAt: r.createdAt.toISOString(),
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

  async getAiMetrics() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [totalRuns, successRuns, failedRuns, todayRuns] = await Promise.all([
      this.prisma.aiRun.count(),
      this.prisma.aiRun.count({ where: { status: 'SUCCESS' } }),
      this.prisma.aiRun.count({ where: { status: 'FAILED' } }),
      this.prisma.aiRun.findMany({
        where: { createdAt: { gte: today } },
        select: {
          provider: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          costEstimate: true,
          latencyMs: true,
        },
      }),
    ]);

    const dailyCostUsd = todayRuns.reduce((sum, r) => sum + (r.costEstimate || 0), 0);
    const dailyTokens = todayRuns.reduce((sum, r) => sum + (r.totalTokens || 0), 0);
    const avgLatencyMs =
      todayRuns.length > 0
        ? Math.round(todayRuns.reduce((sum, r) => sum + r.latencyMs, 0) / todayRuns.length)
        : 0;

    const circuitBreakerStates = this.providerRouter.getCircuitBreakerStates();
    const dailyBudgetUsd = this.providerRouter.getDailyBudgetUsd();

    return {
      totalRuns,
      successRuns,
      failedRuns,
      successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 100,
      todayRunsCount: todayRuns.length,
      todayTokens: dailyTokens,
      todayCostUsd: Number(dailyCostUsd.toFixed(4)),
      dailyBudgetUsd,
      budgetUsedPercentage:
        dailyBudgetUsd > 0 ? Number(((dailyCostUsd / dailyBudgetUsd) * 100).toFixed(1)) : 0,
      avgLatencyMs,
      circuitBreakerStates,
    };
  }

  async listPromptVersions() {
    const versions = await this.prisma.promptVersion.findMany({
      orderBy: [{ slug: 'asc' }, { version: 'desc' }],
    });

    return versions.map(v => ({
      id: v.id,
      slug: v.slug,
      version: v.version,
      systemPrompt: v.systemPrompt,
      userPromptTemplate: v.userPromptTemplate,
      isActive: v.isActive,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async activatePromptVersion(adminId: string, versionId: string) {
    const target = await this.prisma.promptVersion.findUnique({
      where: { id: versionId },
    });

    if (!target) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Prompt version not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Atomic transaction: deactivate previous active versions for this slug, then activate target
    await this.prisma.$transaction([
      this.prisma.promptVersion.updateMany({
        where: { slug: target.slug, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.promptVersion.update({
        where: { id: versionId },
        data: { isActive: true },
      }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: AuditAction.PROMPT_VERSION_ACTIVATED,
        resource: 'prompt_version',
        resourceId: versionId,
        details: { slug: target.slug, version: target.version },
      },
    });

    this.logger.log(
      `Prompt version ${target.slug} v${target.version} activated by admin ${adminId}`,
    );

    return {
      id: target.id,
      slug: target.slug,
      version: target.version,
      isActive: true,
    };
  }

  async getLlmHealth() {
    const circuitBreakerStates = this.providerRouter.getCircuitBreakerStates();
    const priorityChain = this.providerRouter.getPriorityChain();
    const dailyCost = await this.providerRouter.getCurrentDailyCostUsd();
    const dailyBudget = this.providerRouter.getDailyBudgetUsd();

    return {
      providers: priorityChain.map(name => ({
        name,
        state: circuitBreakerStates[name] || 'CLOSED',
        isAvailable: true,
      })),
      priorityChain,
      dailyCostUsd: dailyCost,
      dailyBudgetUsd: dailyBudget,
      isBudgetExceeded: dailyCost >= dailyBudget,
    };
  }

  async clearSemanticCache() {
    const clearedCount = await this.semanticCache.invalidateAll();
    return {
      success: true,
      clearedEntriesCount: clearedCount,
      message: `Cleared ${clearedCount} semantic cache entries`,
    };
  }

  async getSemanticCacheMetrics() {
    return this.semanticCache.getMetrics();
  }
}
