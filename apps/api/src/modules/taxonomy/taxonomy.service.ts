import { Injectable } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

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
}
