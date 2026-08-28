import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  ArenaChallengeStatus,
  ArenaChallengeDomain,
  ArenaChallengeCategory,
  Prisma,
} from '@prisma/client';
import { ArenaChallengeManifest } from '@ai-interview/contracts';

@Injectable()
export class ArenaChallengeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublishedChallenges(filters?: {
    domain?: ArenaChallengeDomain;
    category?: ArenaChallengeCategory;
  }) {
    return this.prisma.engineeringChallenge.findMany({
      where: {
        status: ArenaChallengeStatus.PUBLISHED,
        ...(filters?.domain ? { domain: filters.domain } : {}),
        ...(filters?.category ? { category: filters.category } : {}),
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.engineeringChallenge.findUnique({
      where: { slug },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });
  }

  async findVersionById(versionId: string) {
    return this.prisma.engineeringChallengeVersion.findUnique({
      where: { id: versionId },
      include: { challenge: true },
    });
  }

  async createChallengeWithVersion(
    manifest: ArenaChallengeManifest,
    createdById?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const challenge = await tx.engineeringChallenge.create({
        data: {
          slug: manifest.slug,
          title: manifest.title,
          domain: manifest.domain as ArenaChallengeDomain,
          category: manifest.category as ArenaChallengeCategory,
          difficulty: manifest.difficulty,
          estimatedMinutes: manifest.estimatedMinutes,
          status: ArenaChallengeStatus.PUBLISHED,
          createdById: createdById ?? null,
        },
      });

      const version = await tx.engineeringChallengeVersion.create({
        data: {
          challengeId: challenge.id,
          versionNumber: 1,
          manifestJson: manifest as unknown as Prisma.InputJsonValue,
          manifestSchemaVersion: manifest.schemaVersion,
          rubricVersion: manifest.rubric.version,
          validatorStatus: 'VALID',
          activatedAt: new Date(),
        },
      });

      return { challenge, version };
    });
  }
}
