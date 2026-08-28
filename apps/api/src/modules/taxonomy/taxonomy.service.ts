import { Injectable } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { TaxonomyMatcherService } from './taxonomy-matcher.service';
import { TaxonomyMatchResult } from '@ai-interview/contracts';

@Injectable()
export class TaxonomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomyMatcher: TaxonomyMatcherService,
  ) {}

  async getJobRoles() {
    return this.prisma.jobRole.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getSeniorityLevels() {
    return this.prisma.seniorityLevel.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async getTechnologies() {
    return this.prisma.technology.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async matchCvProfile(profile: {
    targetRole?: string | null;
    seniorityLevel?: string | null;
    skills?: string[];
  }): Promise<TaxonomyMatchResult> {
    const [roles, levels, technologies] = await Promise.all([
      this.getJobRoles(),
      this.getSeniorityLevels(),
      this.getTechnologies(),
    ]);

    return this.taxonomyMatcher.matchCvProfile(profile, roles, levels, technologies);
  }
}
