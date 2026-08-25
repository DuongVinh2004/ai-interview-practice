import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CompetencyArea } from '@ai-interview/contracts';

export interface RoleWeights {
  [CompetencyArea.SYSTEM_DESIGN]: number;
  [CompetencyArea.LANGUAGE_CORE]: number;
  [CompetencyArea.DATABASE_CONCURRENCY]: number;
  [CompetencyArea.ARCHITECTURE_PATTERNS]: number;
  [CompetencyArea.RESILIENCE_SECURITY]: number;
}

@Injectable()
export class WeightProfileService {
  private readonly logger = new Logger(WeightProfileService.name);

  private readonly defaultProfiles: Record<string, RoleWeights> = {
    backend: {
      [CompetencyArea.SYSTEM_DESIGN]: 0.3,
      [CompetencyArea.DATABASE_CONCURRENCY]: 0.25,
      [CompetencyArea.LANGUAGE_CORE]: 0.2,
      [CompetencyArea.ARCHITECTURE_PATTERNS]: 0.15,
      [CompetencyArea.RESILIENCE_SECURITY]: 0.1,
    },
    frontend: {
      [CompetencyArea.LANGUAGE_CORE]: 0.35,
      [CompetencyArea.ARCHITECTURE_PATTERNS]: 0.25,
      [CompetencyArea.SYSTEM_DESIGN]: 0.15,
      [CompetencyArea.RESILIENCE_SECURITY]: 0.15,
      [CompetencyArea.DATABASE_CONCURRENCY]: 0.1,
    },
    fullstack: {
      [CompetencyArea.SYSTEM_DESIGN]: 0.25,
      [CompetencyArea.LANGUAGE_CORE]: 0.25,
      [CompetencyArea.DATABASE_CONCURRENCY]: 0.2,
      [CompetencyArea.ARCHITECTURE_PATTERNS]: 0.15,
      [CompetencyArea.RESILIENCE_SECURITY]: 0.15,
    },
    devops: {
      [CompetencyArea.RESILIENCE_SECURITY]: 0.35,
      [CompetencyArea.SYSTEM_DESIGN]: 0.25,
      [CompetencyArea.ARCHITECTURE_PATTERNS]: 0.2,
      [CompetencyArea.DATABASE_CONCURRENCY]: 0.1,
      [CompetencyArea.LANGUAGE_CORE]: 0.1,
    },
    qa: {
      [CompetencyArea.LANGUAGE_CORE]: 0.3,
      [CompetencyArea.RESILIENCE_SECURITY]: 0.25,
      [CompetencyArea.DATABASE_CONCURRENCY]: 0.2,
      [CompetencyArea.ARCHITECTURE_PATTERNS]: 0.15,
      [CompetencyArea.SYSTEM_DESIGN]: 0.1,
    },
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get weight profile for a specific job role slug
   */
  async getWeightsForRole(jobRoleSlug: string = 'backend'): Promise<RoleWeights> {
    const slug = jobRoleSlug.toLowerCase();
    const dbProfiles = await this.prisma.readinessWeightProfile.findMany({
      where: { jobRoleSlug: slug, isActive: true },
    });

    if (dbProfiles.length > 0) {
      const weights: Partial<RoleWeights> = {};
      for (const p of dbProfiles) {
        weights[p.competencyArea as unknown as CompetencyArea] = p.weight;
      }
      return {
        ...this.defaultProfiles.backend,
        ...weights,
      };
    }

    return this.defaultProfiles[slug] || this.defaultProfiles.backend;
  }

  async getAllProfiles() {
    return this.prisma.readinessWeightProfile.findMany({
      orderBy: [{ jobRoleSlug: 'asc' }, { competencyArea: 'asc' }],
    });
  }

  async upsertWeightProfile(jobRoleSlug: string, competencyArea: CompetencyArea, weight: number) {
    return this.prisma.readinessWeightProfile.upsert({
      where: {
        jobRoleSlug_competencyArea: {
          jobRoleSlug: jobRoleSlug.toLowerCase(),
          competencyArea: competencyArea as any,
        },
      },
      update: { weight, isActive: true },
      create: {
        jobRoleSlug: jobRoleSlug.toLowerCase(),
        competencyArea: competencyArea as any,
        weight,
        isActive: true,
      },
    });
  }
}
