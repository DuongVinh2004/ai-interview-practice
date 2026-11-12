import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  ChallengeValidatorService,
  ChallengeValidationReport,
} from '../../engineering-arena/validator/challenge-validator.service';
import { ArenaChallengeRepository } from '../../engineering-arena/repositories/arena-challenge.repository';
import { ArenaChallengeManifest } from '@ai-interview/contracts';
import { ArenaChallengeStatus, Prisma } from '@prisma/client';

@Injectable()
export class B2bChallengeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validatorService: ChallengeValidatorService,
    private readonly challengeRepo: ArenaChallengeRepository,
  ) {}

  async validateChallenge(params: {
    manifest: ArenaChallengeManifest;
    visibleFilesContent: Record<string, string>;
    hiddenFilesContent: Record<string, string>;
    referenceSolutionContent?: Record<string, string>;
  }): Promise<ChallengeValidationReport> {
    return this.validatorService.validateChallengePackage(params);
  }

  async createCustomChallenge(params: {
    tenantId: string;
    userId: string;
    manifest: ArenaChallengeManifest;
    visibleFilesContent: Record<string, string>;
    hiddenFilesContent: Record<string, string>;
  }) {
    // 1. Validate package
    const report = await this.validatorService.validateChallengePackage({
      manifest: params.manifest,
      visibleFilesContent: params.visibleFilesContent,
      hiddenFilesContent: params.hiddenFilesContent,
    });

    if (!report.overallPass) {
      const errorMsg = report.stages
        .filter(s => s.status === 'FAIL')
        .map(s => `${s.stage}: ${s.message}`)
        .join('; ');
      throw new BadRequestException(`Challenge validation failed: ${errorMsg}`);
    }

    // 2. Check slug uniqueness
    const existing = await this.challengeRepo.findBySlug(params.manifest.slug);
    if (existing) {
      throw new ConflictException(`Challenge with slug '${params.manifest.slug}' already exists.`);
    }

    // 3. Inject tenant context into metadata
    const manifestWithTenant = {
      ...params.manifest,
      metadata: {
        ...(params.manifest as any).metadata,
        tenantId: params.tenantId,
        authorType: 'B2B_ENTERPRISE',
      },
    };

    return this.prisma.$transaction(async tx => {
      const challenge = await tx.engineeringChallenge.create({
        data: {
          slug: params.manifest.slug,
          title: params.manifest.title,
          domain: params.manifest.domain as any,
          category: params.manifest.category as any,
          difficulty: params.manifest.difficulty,
          estimatedMinutes: params.manifest.estimatedMinutes,
          status: ArenaChallengeStatus.DRAFT,
          createdById: params.userId,
        },
      });

      const version = await tx.engineeringChallengeVersion.create({
        data: {
          challengeId: challenge.id,
          versionNumber: 1,
          manifestJson: manifestWithTenant as unknown as Prisma.InputJsonValue,
          manifestSchemaVersion: params.manifest.schemaVersion,
          rubricVersion: params.manifest.rubric.version,
          validatorStatus: 'VALID',
          validationSummary: JSON.stringify(report),
        },
      });

      return { challenge, version, validationReport: report };
    });
  }

  async listTenantChallenges(tenantId: string, userId: string) {
    return this.prisma.engineeringChallenge.findMany({
      where: { createdById: userId },
      include: { versions: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTenantChallenge(challengeId: string, tenantId: string, userId: string) {
    const challenge = await this.prisma.engineeringChallenge.findUnique({
      where: { id: challengeId },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });

    if (!challenge) {
      throw new NotFoundException(`Challenge '${challengeId}' not found.`);
    }

    if (challenge.createdById !== userId) {
      throw new ForbiddenException('Access denied: You are not authorized to view this challenge.');
    }

    return challenge;
  }

  async publishTenantChallenge(challengeId: string, tenantId: string, userId: string) {
    const challenge = await this.prisma.engineeringChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new NotFoundException(`Challenge '${challengeId}' not found.`);
    }

    if (challenge.createdById !== userId) {
      throw new ForbiddenException(
        'Access denied: You are not authorized to modify this challenge.',
      );
    }

    const latestVersion = await this.prisma.engineeringChallengeVersion.findFirst({
      where: { challengeId, validatorStatus: 'VALID' },
      orderBy: { versionNumber: 'desc' },
    });

    if (!latestVersion) {
      throw new BadRequestException('Cannot publish challenge without a valid version.');
    }

    return this.prisma.$transaction(async tx => {
      await tx.engineeringChallengeVersion.updateMany({
        where: { challengeId, activatedAt: { not: null } },
        data: { deprecatedAt: new Date() },
      });

      await tx.engineeringChallengeVersion.update({
        where: { id: latestVersion.id },
        data: { activatedAt: new Date() },
      });

      return tx.engineeringChallenge.update({
        where: { id: challengeId },
        data: { status: ArenaChallengeStatus.PUBLISHED },
      });
    });
  }
}
