import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import {
  ErrorCode,
  AuditAction,
  SessionMode,
  CompetencyArea,
  InterviewConfigurationPresetDto,
  RecentInterviewConfigurationDto,
  ValidationResultDto,
  ValidationIssue,
} from '@ai-interview/contracts';
import {
  InterviewConfigurationDto,
  CreatePresetRequestDto,
  UpdatePresetRequestDto,
} from './dto/interview-configuration.dto';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class InterviewConfigurationService {
  private readonly logger = new Logger(InterviewConfigurationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  /**
   * Generates a deterministic SHA-256 fingerprint for a configuration.
   * Normalizes arrays (sorted technology IDs) and defaults.
   */
  computeFingerprint(config: Partial<InterviewConfigurationDto>): string {
    const roleId = config.jobRoleId || '';
    const levelId = config.seniorityLevelId || '';
    const techs = [...(config.technologyIds || [])]
      .map(t => t.trim().toLowerCase())
      .sort()
      .join(',');
    const mode = config.sessionMode || SessionMode.STANDARD;
    const competency = config.competencyArea || '';
    const language = (config.language || 'vi').toLowerCase();
    const turns = config.totalTurns || 5;
    const sandbox = config.isSandbox ? '1' : '0';
    const blueprint = config.blueprintId || '';

    const raw = `${roleId}|${levelId}|${techs}|${mode}|${competency}|${language}|${turns}|${sandbox}|${blueprint}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Resolves taxonomy items into an immutable JSON snapshot for session persistence.
   */
  async buildConfigurationSnapshot(
    config: InterviewConfigurationDto,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Record<string, any>> {
    const [jobRole, seniorityLevel, technologies] = await Promise.all([
      prismaClient.jobRole.findUnique({ where: { id: config.jobRoleId } }),
      prismaClient.seniorityLevel.findUnique({ where: { id: config.seniorityLevelId } }),
      prismaClient.technology.findMany({ where: { id: { in: config.technologyIds } } }),
    ]);

    const fingerprint = this.computeFingerprint(config);

    return {
      fingerprint,
      jobRole: jobRole
        ? { id: jobRole.id, slug: jobRole.slug, name: jobRole.name }
        : { id: config.jobRoleId, name: 'Unknown' },
      seniorityLevel: seniorityLevel
        ? {
            id: seniorityLevel.id,
            slug: seniorityLevel.slug,
            name: seniorityLevel.name,
            order: seniorityLevel.order,
          }
        : { id: config.seniorityLevelId, name: 'Unknown' },
      technologies: technologies.map(t => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        category: t.category,
      })),
      sessionMode: config.sessionMode || SessionMode.STANDARD,
      competencyArea: config.competencyArea || null,
      language: config.language || 'vi',
      totalTurns: config.totalTurns || 5,
      isSandbox: !!config.isSandbox,
      blueprintId: config.blueprintId || null,
      snapshotTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Validates configuration compatibility with current active taxonomy and entitlements.
   */
  async validateConfiguration(
    userId: string,
    config: InterviewConfigurationDto,
  ): Promise<ValidationResultDto> {
    const issues: ValidationIssue[] = [];
    const fingerprint = this.computeFingerprint(config);

    const [jobRole, seniorityLevel, technologies] = await Promise.all([
      this.prisma.jobRole.findUnique({ where: { id: config.jobRoleId } }),
      this.prisma.seniorityLevel.findUnique({ where: { id: config.seniorityLevelId } }),
      this.prisma.technology.findMany({ where: { id: { in: config.technologyIds } } }),
    ]);

    if (!jobRole) {
      issues.push({
        field: 'jobRoleId',
        code: 'ROLE_NOT_FOUND',
        message: 'Vị trí công việc không tồn tại trong hệ thống',
      });
    } else if (!jobRole.isActive) {
      issues.push({
        field: 'jobRoleId',
        code: 'ROLE_INACTIVE',
        message: `Vị trí công việc "${jobRole.name}" hiện đang bị vô hiệu hóa`,
      });
    }

    if (!seniorityLevel) {
      issues.push({
        field: 'seniorityLevelId',
        code: 'LEVEL_NOT_FOUND',
        message: 'Cấp bậc kinh nghiệm không tồn tại',
      });
    } else if (!seniorityLevel.isActive) {
      issues.push({
        field: 'seniorityLevelId',
        code: 'LEVEL_INACTIVE',
        message: `Cấp bậc "${seniorityLevel.name}" hiện đang bị vô hiệu hóa`,
      });
    }

    const foundTechIds = new Set(technologies.map(t => t.id));
    const missingTechIds = config.technologyIds.filter(id => !foundTechIds.has(id));
    const inactiveTechs = technologies.filter(t => !t.isActive);

    if (missingTechIds.length > 0) {
      issues.push({
        field: 'technologyIds',
        code: 'TECHNOLOGY_NOT_FOUND',
        message: `${missingTechIds.length} công nghệ không tồn tại trong cơ sở dữ liệu`,
      });
    }

    if (inactiveTechs.length > 0) {
      issues.push({
        field: 'technologyIds',
        code: 'TECHNOLOGY_INACTIVE',
        message: `Công nghệ [${inactiveTechs.map(t => t.name).join(', ')}] đã tạm ngừng sử dụng`,
      });
    }

    if (config.technologyIds.length < 1 || config.technologyIds.length > 5) {
      issues.push({
        field: 'technologyIds',
        code: 'INVALID_TECH_COUNT',
        message: 'Số lượng công nghệ phải từ 1 đến 5',
      });
    }

    // Entitlement checks
    try {
      const sub = await this.billingService.getSubscription(userId);
      const planLimits = sub?.plan?.limits as any;
      if (config.sessionMode === SessionMode.CODING && planLimits?.allowLiveCoding === false) {
        issues.push({
          field: 'sessionMode',
          code: 'MODE_NOT_ALLOWED',
          message: 'Gói tài khoản hiện tại không hỗ trợ chế độ Live Coding Sandbox',
        });
      }
      if (
        config.sessionMode === SessionMode.SYSTEM_DESIGN &&
        planLimits?.allowSystemDesign === false
      ) {
        issues.push({
          field: 'sessionMode',
          code: 'MODE_NOT_ALLOWED',
          message: 'Gói tài khoản hiện tại không hỗ trợ chế độ System Design Whiteboard',
        });
      }
    } catch (err: any) {
      this.logger.warn(`Could not verify billing entitlement for user ${userId}: ${err.message}`);
    }

    return {
      isValid: issues.length === 0,
      fingerprint,
      issues,
      resolvedTaxonomy: {
        jobRole: jobRole
          ? {
              id: jobRole.id,
              slug: jobRole.slug,
              name: jobRole.name,
              description: jobRole.description,
              isActive: jobRole.isActive,
            }
          : null,
        seniorityLevel: seniorityLevel
          ? {
              id: seniorityLevel.id,
              slug: seniorityLevel.slug,
              name: seniorityLevel.name,
              order: seniorityLevel.order,
              description: seniorityLevel.description,
              isActive: seniorityLevel.isActive,
            }
          : null,
        technologies: technologies.map(t => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          category: t.category,
          isActive: t.isActive,
        })),
      },
    };
  }

  /**
   * Retrieves max allowed presets for a user's subscription tier.
   */
  async getPresetLimit(userId: string): Promise<number> {
    try {
      const sub = await this.billingService.getSubscription(userId);
      const slug = sub?.plan?.slug || 'free';
      switch (slug.toLowerCase()) {
        case 'pro':
          return 20;
        case 'team':
          return 50;
        case 'enterprise':
          return 100;
        case 'free':
        default:
          return 3;
      }
    } catch {
      return 3;
    }
  }

  /**
   * Creates a new user preset with entitlement limit & uniqueness enforcement.
   */
  async createPreset(
    userId: string,
    dto: CreatePresetRequestDto,
  ): Promise<InterviewConfigurationPresetDto> {
    const maxPresets = await this.getPresetLimit(userId);
    const currentCount = await this.prisma.interviewConfigurationPreset.count({
      where: { userId },
    });

    if (currentCount >= maxPresets) {
      throw new DomainException(
        ErrorCode.QUOTA_EXCEEDED,
        `Bạn đã đạt giới hạn tối đa ${maxPresets} preset cấu hình của gói tài khoản hiện tại. Hãy nâng cấp gói để lưu thêm.`,
        HttpStatus.FORBIDDEN,
      );
    }

    // Check unique name per user
    const trimmedName = dto.name.trim();
    const existing = await this.prisma.interviewConfigurationPreset.findUnique({
      where: { userId_name: { userId, name: trimmedName } },
    });

    if (existing) {
      throw new DomainException(
        ErrorCode.DUPLICATE_RESOURCE,
        `Đã tồn tại preset với tên "${trimmedName}". Vui lòng chọn tên khác.`,
        HttpStatus.CONFLICT,
      );
    }

    const validation = await this.validateConfiguration(userId, dto.config);
    if (!validation.isValid) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        `Cấu hình không hợp lệ: ${validation.issues.map(i => i.message).join('; ')}`,
        HttpStatus.BAD_REQUEST,
        validation.issues,
      );
    }

    const fingerprint = this.computeFingerprint(dto.config);

    const preset = await this.prisma.interviewConfigurationPreset.create({
      data: {
        userId,
        name: trimmedName,
        description: dto.description?.trim() || null,
        jobRoleId: dto.config.jobRoleId,
        seniorityLevelId: dto.config.seniorityLevelId,
        technologyIds: dto.config.technologyIds,
        sessionMode: dto.config.sessionMode || SessionMode.STANDARD,
        competencyArea: dto.config.competencyArea || null,
        language: dto.config.language || 'vi',
        totalTurns: dto.config.totalTurns || 5,
        isSandbox: !!dto.config.isSandbox,
        blueprintId: dto.config.blueprintId || null,
        isPinned: !!dto.isPinned,
        fingerprint,
      },
      include: {
        jobRole: true,
        seniorityLevel: true,
      },
    });

    const technologies = await this.prisma.technology.findMany({
      where: { id: { in: preset.technologyIds } },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.SESSION_CREATED,
        resource: 'interview_configuration_preset',
        resourceId: preset.id,
        details: { name: preset.name, fingerprint },
      },
    });

    return this.mapPresetToDto(preset, technologies, validation);
  }

  /**
   * Updates an existing preset. Strictly scoped to authenticated userId.
   */
  async updatePreset(
    userId: string,
    presetId: string,
    dto: UpdatePresetRequestDto,
  ): Promise<InterviewConfigurationPresetDto> {
    const preset = await this.prisma.interviewConfigurationPreset.findUnique({
      where: { id: presetId },
    });

    if (!preset || preset.userId !== userId) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy preset cấu hình hoặc bạn không có quyền truy cập',
        HttpStatus.NOT_FOUND,
      );
    }

    const dataToUpdate: Prisma.InterviewConfigurationPresetUpdateInput = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (trimmedName !== preset.name) {
        const duplicate = await this.prisma.interviewConfigurationPreset.findUnique({
          where: { userId_name: { userId, name: trimmedName } },
        });
        if (duplicate) {
          throw new DomainException(
            ErrorCode.DUPLICATE_RESOURCE,
            `Đã tồn tại preset với tên "${trimmedName}". Vui lòng chọn tên khác.`,
            HttpStatus.CONFLICT,
          );
        }
        dataToUpdate.name = trimmedName;
      }
    }

    if (dto.description !== undefined) {
      dataToUpdate.description = dto.description?.trim() || null;
    }

    if (dto.isPinned !== undefined) {
      dataToUpdate.isPinned = dto.isPinned;
    }

    let validationResult: ValidationResultDto | undefined;

    if (dto.config) {
      validationResult = await this.validateConfiguration(userId, dto.config);
      if (!validationResult.isValid) {
        throw new DomainException(
          ErrorCode.VALIDATION_ERROR,
          `Cấu hình cập nhật không hợp lệ: ${validationResult.issues.map(i => i.message).join('; ')}`,
          HttpStatus.BAD_REQUEST,
          validationResult.issues,
        );
      }

      dataToUpdate.jobRole = { connect: { id: dto.config.jobRoleId } };
      dataToUpdate.seniorityLevel = { connect: { id: dto.config.seniorityLevelId } };
      dataToUpdate.technologyIds = dto.config.technologyIds;
      dataToUpdate.sessionMode = dto.config.sessionMode || SessionMode.STANDARD;
      dataToUpdate.competencyArea = dto.config.competencyArea || null;
      dataToUpdate.language = dto.config.language || 'vi';
      dataToUpdate.totalTurns = dto.config.totalTurns || 5;
      dataToUpdate.isSandbox = !!dto.config.isSandbox;
      dataToUpdate.blueprintId = dto.config.blueprintId || null;
      dataToUpdate.fingerprint = this.computeFingerprint(dto.config);
    }

    const updated = await this.prisma.interviewConfigurationPreset.update({
      where: { id: presetId },
      data: dataToUpdate,
      include: {
        jobRole: true,
        seniorityLevel: true,
      },
    });

    const technologies = await this.prisma.technology.findMany({
      where: { id: { in: updated.technologyIds } },
    });

    if (!validationResult) {
      validationResult = await this.validateConfiguration(userId, {
        jobRoleId: updated.jobRoleId,
        seniorityLevelId: updated.seniorityLevelId,
        technologyIds: updated.technologyIds,
        sessionMode: updated.sessionMode as unknown as SessionMode,
        competencyArea: updated.competencyArea
          ? (updated.competencyArea as unknown as CompetencyArea)
          : undefined,
        language: updated.language,
        totalTurns: updated.totalTurns,
        isSandbox: updated.isSandbox,
        blueprintId: updated.blueprintId || undefined,
      });
    }

    return this.mapPresetToDto(updated, technologies, validationResult);
  }

  /**
   * Deletes a preset. Historical sessions remain intact.
   */
  async deletePreset(userId: string, presetId: string): Promise<{ success: boolean; id: string }> {
    const preset = await this.prisma.interviewConfigurationPreset.findUnique({
      where: { id: presetId },
    });

    if (!preset || preset.userId !== userId) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy preset cấu hình hoặc bạn không có quyền truy cập',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.interviewConfigurationPreset.delete({
      where: { id: presetId },
    });

    return { success: true, id: presetId };
  }

  /**
   * Lists all presets for a user with pinned presets first, sorted by update time.
   */
  async listPresets(userId: string): Promise<InterviewConfigurationPresetDto[]> {
    const presets = await this.prisma.interviewConfigurationPreset.findMany({
      where: { userId },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      include: {
        jobRole: true,
        seniorityLevel: true,
      },
    });

    if (presets.length === 0) return [];

    const allTechIds = Array.from(
      new Set(presets.flatMap((p: any) => p.technologyIds as string[])),
    );
    const allTechnologies = await this.prisma.technology.findMany({
      where: { id: { in: allTechIds } },
    });
    const techMap = new Map(allTechnologies.map(t => [t.id, t]));

    return presets.map((p: any) => {
      const pTechs = (p.technologyIds as string[])
        .map((id: string) => techMap.get(id))
        .filter(Boolean) as any[];
      const isRoleActive = p.jobRole.isActive;
      const isLevelActive = p.seniorityLevel.isActive;
      const allTechsFound = pTechs.length === p.technologyIds.length;
      const allTechsActive = pTechs.every(t => t.isActive);

      const incompatibilityReasons: string[] = [];
      if (!isRoleActive) incompatibilityReasons.push(`Vị trí "${p.jobRole.name}" đã tạm ngưng`);
      if (!isLevelActive)
        incompatibilityReasons.push(`Cấp bậc "${p.seniorityLevel.name}" đã tạm ngưng`);
      if (!allTechsFound || !allTechsActive)
        incompatibilityReasons.push('Một số công nghệ trong preset đã thay đổi hoặc tạm ngưng');

      const isCompatible = incompatibilityReasons.length === 0;

      return {
        id: p.id,
        userId: p.userId,
        name: p.name,
        description: p.description,
        jobRoleId: p.jobRoleId,
        seniorityLevelId: p.seniorityLevelId,
        technologyIds: p.technologyIds,
        sessionMode: p.sessionMode as unknown as SessionMode,
        competencyArea: p.competencyArea ? (p.competencyArea as unknown as CompetencyArea) : null,
        language: p.language,
        totalTurns: p.totalTurns,
        isSandbox: p.isSandbox,
        blueprintId: p.blueprintId,
        isPinned: p.isPinned,
        useCount: p.useCount,
        lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
        fingerprint: p.fingerprint,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        jobRole: {
          id: p.jobRole.id,
          slug: p.jobRole.slug,
          name: p.jobRole.name,
          description: p.jobRole.description,
          isActive: p.jobRole.isActive,
        },
        seniorityLevel: {
          id: p.seniorityLevel.id,
          slug: p.seniorityLevel.slug,
          name: p.seniorityLevel.name,
          order: p.seniorityLevel.order,
          description: p.seniorityLevel.description,
          isActive: p.seniorityLevel.isActive,
        },
        technologies: pTechs.map(t => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          category: t.category,
          isActive: t.isActive,
        })),
        isCompatible,
        incompatibilityReasons,
      };
    });
  }

  /**
   * Lists recent configurations for a user ordered by lastUsedAt desc.
   */
  async listRecent(userId: string, limit: number = 8): Promise<RecentInterviewConfigurationDto[]> {
    const recents = await this.prisma.recentInterviewConfiguration.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
      take: limit,
      include: {
        jobRole: true,
        seniorityLevel: true,
      },
    });

    if (recents.length === 0) return [];

    const allTechIds = Array.from(
      new Set(recents.flatMap((r: any) => r.technologyIds as string[])),
    );
    const allTechnologies = await this.prisma.technology.findMany({
      where: { id: { in: allTechIds } },
    });
    const techMap = new Map(allTechnologies.map(t => [t.id, t]));

    return recents.map((r: any) => {
      const rTechs = (r.technologyIds as string[])
        .map((id: string) => techMap.get(id))
        .filter(Boolean) as any[];
      const isRoleActive = r.jobRole.isActive;
      const isLevelActive = r.seniorityLevel.isActive;
      const allTechsFound = rTechs.length === r.technologyIds.length;
      const allTechsActive = rTechs.every(t => t.isActive);

      const incompatibilityReasons: string[] = [];
      if (!isRoleActive) incompatibilityReasons.push(`Vị trí "${r.jobRole.name}" đã tạm ngưng`);
      if (!isLevelActive)
        incompatibilityReasons.push(`Cấp bậc "${r.seniorityLevel.name}" đã tạm ngưng`);
      if (!allTechsFound || !allTechsActive)
        incompatibilityReasons.push('Một số công nghệ đã thay đổi hoặc tạm ngưng');

      return {
        id: r.id,
        userId: r.userId,
        fingerprint: r.fingerprint,
        jobRoleId: r.jobRoleId,
        seniorityLevelId: r.seniorityLevelId,
        technologyIds: r.technologyIds,
        sessionMode: r.sessionMode as unknown as SessionMode,
        competencyArea: r.competencyArea ? (r.competencyArea as unknown as CompetencyArea) : null,
        language: r.language,
        totalTurns: r.totalTurns,
        isSandbox: r.isSandbox,
        blueprintId: r.blueprintId,
        useCount: r.useCount,
        lastUsedAt: r.lastUsedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        jobRole: {
          id: r.jobRole.id,
          slug: r.jobRole.slug,
          name: r.jobRole.name,
          description: r.jobRole.description,
          isActive: r.jobRole.isActive,
        },
        seniorityLevel: {
          id: r.seniorityLevel.id,
          slug: r.seniorityLevel.slug,
          name: r.seniorityLevel.name,
          order: r.seniorityLevel.order,
          description: r.seniorityLevel.description,
          isActive: r.seniorityLevel.isActive,
        },
        technologies: rTechs.map(t => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          category: t.category,
          isActive: t.isActive,
        })),
        isCompatible: incompatibilityReasons.length === 0,
        incompatibilityReasons,
      };
    });
  }

  /**
   * Upserts recent configuration upon successful interview session creation.
   */
  async recordRecentConfiguration(
    userId: string,
    config: InterviewConfigurationDto,
    presetId?: string,
  ): Promise<void> {
    try {
      const fingerprint = this.computeFingerprint(config);
      const now = new Date();

      await this.prisma.recentInterviewConfiguration.upsert({
        where: { userId_fingerprint: { userId, fingerprint } },
        create: {
          userId,
          fingerprint,
          jobRoleId: config.jobRoleId,
          seniorityLevelId: config.seniorityLevelId,
          technologyIds: config.technologyIds,
          sessionMode: config.sessionMode || SessionMode.STANDARD,
          competencyArea: config.competencyArea || null,
          language: config.language || 'vi',
          totalTurns: config.totalTurns || 5,
          isSandbox: !!config.isSandbox,
          blueprintId: config.blueprintId || null,
          useCount: 1,
          lastUsedAt: now,
        },
        update: {
          useCount: { increment: 1 },
          lastUsedAt: now,
        },
      });

      if (presetId) {
        await this.prisma.interviewConfigurationPreset
          .updateMany({
            where: { id: presetId, userId },
            data: {
              useCount: { increment: 1 },
              lastUsedAt: now,
            },
          })
          .catch(() => {});
      }
    } catch (err: any) {
      this.logger.warn(`Failed to record recent configuration for user ${userId}: ${err.message}`);
    }
  }

  private mapPresetToDto(
    preset: any,
    technologies: any[],
    validation: ValidationResultDto,
  ): InterviewConfigurationPresetDto {
    return {
      id: preset.id,
      userId: preset.userId,
      name: preset.name,
      description: preset.description,
      jobRoleId: preset.jobRoleId,
      seniorityLevelId: preset.seniorityLevelId,
      technologyIds: preset.technologyIds,
      sessionMode: preset.sessionMode as unknown as SessionMode,
      competencyArea: preset.competencyArea
        ? (preset.competencyArea as unknown as CompetencyArea)
        : null,
      language: preset.language,
      totalTurns: preset.totalTurns,
      isSandbox: preset.isSandbox,
      blueprintId: preset.blueprintId,
      isPinned: preset.isPinned,
      useCount: preset.useCount,
      lastUsedAt: preset.lastUsedAt?.toISOString() || null,
      fingerprint: preset.fingerprint,
      createdAt: preset.createdAt.toISOString(),
      updatedAt: preset.updatedAt.toISOString(),
      jobRole: preset.jobRole
        ? {
            id: preset.jobRole.id,
            slug: preset.jobRole.slug,
            name: preset.jobRole.name,
            description: preset.jobRole.description,
            isActive: preset.jobRole.isActive,
          }
        : undefined,
      seniorityLevel: preset.seniorityLevel
        ? {
            id: preset.seniorityLevel.id,
            slug: preset.seniorityLevel.slug,
            name: preset.seniorityLevel.name,
            order: preset.seniorityLevel.order,
            description: preset.seniorityLevel.description,
            isActive: preset.seniorityLevel.isActive,
          }
        : undefined,
      technologies: technologies.map(t => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        category: t.category,
        isActive: t.isActive,
      })),
      isCompatible: validation.isValid,
      incompatibilityReasons: validation.issues.map(i => i.message),
    };
  }
}
