import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { TenantRole, UserRole, UserStatus } from '@ai-interview/contracts';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CohortService {
  constructor(private readonly prisma: PrismaService) {}

  async createCohort(tenantId: string, name: string, description?: string) {
    const cohort = await this.prisma.cohort.create({
      data: {
        tenantId,
        name,
        description: description || null,
        isActive: true,
      },
    });

    return cohort;
  }

  async listCohorts(tenantId: string) {
    const cohorts = await this.prisma.cohort.findMany({
      where: { tenantId },
      include: {
        members: true,
        assignments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return cohorts.map(c => ({
      id: c.id,
      tenantId: c.tenantId,
      name: c.name,
      description: c.description,
      isActive: c.isActive,
      memberCount: c.members.length,
      assignmentCount: c.assignments.length,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async getCohort(cohortId: string, tenantId: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, tenantId },
      include: {
        members: {
          include: {
            tenantMember: {
              include: {
                user: {
                  include: { profile: true },
                },
              },
            },
          },
        },
        assignments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!cohort) {
      throw new NotFoundException('Cohort not found in this organization');
    }

    return {
      id: cohort.id,
      tenantId: cohort.tenantId,
      name: cohort.name,
      description: cohort.description,
      isActive: cohort.isActive,
      members: cohort.members.map(m => ({
        cohortMemberId: m.id,
        tenantMemberId: m.tenantMemberId,
        userId: m.tenantMember.userId,
        email: m.tenantMember.user.email,
        fullName: m.tenantMember.user.profile?.fullName || m.tenantMember.user.email.split('@')[0],
        role: m.tenantMember.role,
        enrolledAt: m.enrolledAt,
      })),
      assignments: cohort.assignments,
      createdAt: cohort.createdAt,
      updatedAt: cohort.updatedAt,
    };
  }

  async importRosterCsv(cohortId: string, tenantId: string, csvContent: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, tenantId },
    });

    if (!cohort) {
      throw new NotFoundException('Cohort not found');
    }

    const lines = csvContent
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      throw new BadRequestException('CSV file is empty');
    }

    let successCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Check if line 0 is a header (contains "email" or "name")
    const startIndex = lines[0].toLowerCase().includes('email') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      const email = parts[0]?.toLowerCase();
      const fullName = parts[1] || '';
      const roleStr = parts[2]?.toUpperCase();

      if (!email || !email.includes('@')) {
        errors.push(`Row ${i + 1}: Invalid email address "${email || ''}"`);
        skippedCount++;
        continue;
      }

      const role: TenantRole =
        roleStr === 'INSTRUCTOR' ? TenantRole.INSTRUCTOR : TenantRole.STUDENT;

      try {
        // 1. Find or create user
        let user = await this.prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          // Generate cryptographically secure random password with bcrypt (F-015)
          const tempPassword = crypto.randomBytes(32).toString('base64url');
          const tempPasswordHash = await bcrypt.hash(tempPassword, 10);

          user = await this.prisma.user.create({
            data: {
              email,
              passwordHash: tempPasswordHash,
              role: UserRole.CANDIDATE,
              status: UserStatus.ACTIVE,
              profile: {
                create: {
                  fullName: fullName || email.split('@')[0],
                },
              },
            },
          });
        }

        // 2. Ensure TenantMember
        let tenantMember = await this.prisma.tenantMember.findUnique({
          where: {
            tenantId_userId: {
              tenantId,
              userId: user.id,
            },
          },
        });

        if (!tenantMember) {
          tenantMember = await this.prisma.tenantMember.create({
            data: {
              tenantId,
              userId: user.id,
              role,
            },
          });
        }

        // 3. Ensure CohortMember
        const existingCohortMember = await this.prisma.cohortMember.findUnique({
          where: {
            cohortId_tenantMemberId: {
              cohortId,
              tenantMemberId: tenantMember.id,
            },
          },
        });

        if (!existingCohortMember) {
          await this.prisma.cohortMember.create({
            data: {
              cohortId,
              tenantMemberId: tenantMember.id,
            },
          });
          successCount++;
        } else {
          skippedCount++;
        }
      } catch (err: any) {
        errors.push(`Row ${i + 1} (${email}): ${err.message}`);
        skippedCount++;
      }
    }

    return {
      totalImported: lines.length - startIndex,
      successCount,
      skippedCount,
      errors,
    };
  }
}
