import { Injectable, HttpStatus } from '@nestjs/common';
import { ArenaChallengeRepository } from '../repositories/arena-challenge.repository';
import { ChallengeValidatorService } from '../validator/challenge-validator.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ArenaChallengeManifest, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ArenaChallengeStatus, Prisma } from '@prisma/client';

@Injectable()
export class ArenaAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly challengeRepo: ArenaChallengeRepository,
    private readonly validatorService: ChallengeValidatorService,
  ) {}

  async createChallengeDraft(data: {
    manifest: ArenaChallengeManifest;
    adminId: string;
    visibleFilesContent: Record<string, string>;
    hiddenFilesContent: Record<string, string>;
  }) {
    const existing = await this.challengeRepo.findBySlug(data.manifest.slug);
    if (existing) {
      throw new DomainException(
        ErrorCode.DUPLICATE_RESOURCE,
        `Challenge with slug '${data.manifest.slug}' already exists.`,
        HttpStatus.CONFLICT,
      );
    }

    // Run validator
    const report = await this.validatorService.validateChallengePackage({
      manifest: data.manifest,
      visibleFilesContent: data.visibleFilesContent,
      hiddenFilesContent: data.hiddenFilesContent,
    });

    return this.prisma.$transaction(async tx => {
      const challenge = await tx.engineeringChallenge.create({
        data: {
          slug: data.manifest.slug,
          title: data.manifest.title,
          domain: data.manifest.domain as any,
          category: data.manifest.category as any,
          difficulty: data.manifest.difficulty,
          estimatedMinutes: data.manifest.estimatedMinutes,
          status: ArenaChallengeStatus.DRAFT,
          createdById: data.adminId,
        },
      });

      const version = await tx.engineeringChallengeVersion.create({
        data: {
          challengeId: challenge.id,
          versionNumber: 1,
          manifestJson: data.manifest as unknown as Prisma.InputJsonValue,
          manifestSchemaVersion: data.manifest.schemaVersion,
          rubricVersion: data.manifest.rubric.version,
          validatorStatus: report.overallPass ? 'VALID' : 'INVALID',
          validationSummary: JSON.stringify(report),
        },
      });

      return { challenge, version, validationReport: report };
    });
  }

  async activateVersion(versionId: string) {
    const version = await this.challengeRepo.findVersionById(versionId);
    if (!version) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Challenge version '${versionId}' not found.`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (version.validatorStatus !== 'VALID') {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        `Cannot activate version '${versionId}' because validator status is ${version.validatorStatus}.`,
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    return this.prisma.$transaction(async tx => {
      // Deprecate older active versions
      await tx.engineeringChallengeVersion.updateMany({
        where: {
          challengeId: version.challengeId,
          activatedAt: { not: null },
          deprecatedAt: null,
        },
        data: { deprecatedAt: new Date() },
      });

      // Activate current version
      const updatedVersion = await tx.engineeringChallengeVersion.update({
        where: { id: versionId },
        data: { activatedAt: new Date() },
      });

      // Mark parent challenge as PUBLISHED
      await tx.engineeringChallenge.update({
        where: { id: version.challengeId },
        data: { status: ArenaChallengeStatus.PUBLISHED },
      });

      return updatedVersion;
    });
  }

  async deprecateVersion(versionId: string) {
    return this.prisma.engineeringChallengeVersion.update({
      where: { id: versionId },
      data: { deprecatedAt: new Date() },
    });
  }
}
