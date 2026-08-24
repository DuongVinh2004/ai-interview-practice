import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { AssignmentStatus, SessionMode } from '@ai-interview/contracts';

export interface CreateAssignmentInput {
  cohortId: string;
  title: string;
  description?: string;
  deadline?: Date | string;
  config?: {
    sessionMode?: SessionMode;
    difficulty?: number;
    targetScore?: number;
    rubricId?: string;
    questionBankId?: string;
  };
}

@Injectable()
export class AssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async createAssignment(cohortId: string, tenantId: string, input: CreateAssignmentInput) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, tenantId },
    });

    if (!cohort) {
      throw new NotFoundException('Cohort not found in this organization');
    }

    const assignment = await this.prisma.assignment.create({
      data: {
        cohortId,
        title: input.title,
        description: input.description || null,
        status: AssignmentStatus.DRAFT,
        deadline: input.deadline ? new Date(input.deadline) : null,
        config: input.config || {
          sessionMode: SessionMode.STANDARD,
          difficulty: 2,
          targetScore: 7.0,
        },
      },
    });

    return assignment;
  }

  async publishAssignment(assignmentId: string, tenantId: string, status: AssignmentStatus) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { cohort: true },
    });

    if (!assignment || assignment.cohort.tenantId !== tenantId) {
      throw new NotFoundException('Assignment not found');
    }

    const updated = await this.prisma.assignment.update({
      where: { id: assignmentId },
      data: { status },
    });

    return updated;
  }

  async listCohortAssignments(cohortId: string, tenantId: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, tenantId },
      include: {
        members: true,
      },
    });

    if (!cohort) {
      throw new NotFoundException('Cohort not found');
    }

    const assignments = await this.prisma.assignment.findMany({
      where: { cohortId },
      orderBy: { createdAt: 'desc' },
    });

    return assignments.map((a) => ({
      id: a.id,
      cohortId: a.cohortId,
      title: a.title,
      description: a.description,
      status: a.status,
      deadline: a.deadline,
      config: a.config,
      totalCandidates: cohort.members.length,
      completedCandidates: 0,
      averageScore: null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
  }
}
