import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { AssignmentStatus, SessionMode } from '@ai-interview/contracts';
import { CohortAccessContext, CohortAccessPolicy } from '../policies/cohort-access.policy';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly cohortAccessPolicy: CohortAccessPolicy,
  ) {}

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

  async listCohortAssignments(cohortId: string, access: CohortAccessContext) {
    const isStudent = this.cohortAccessPolicy.isStudent(access);
    const cohort = await this.prisma.cohort.findFirst({
      where: this.cohortAccessPolicy.buildReadPredicate(cohortId, access),
      include: {
        members: !isStudent,
      },
    });

    if (!cohort) {
      throw new NotFoundException('Cohort not found');
    }

    const assignments: any[] = await this.prisma.assignment.findMany({
      where: {
        cohortId,
        ...(isStudent && { status: AssignmentStatus.PUBLISHED }),
      },
      ...(isStudent
        ? {}
        : {
            include: {
              sessions: {
                where: { state: 'COMPLETED' },
              },
            },
          }),
      orderBy: { createdAt: 'desc' },
    });

    return assignments.map(a => {
      if (isStudent) {
        const config = (a.config || {}) as Record<string, unknown>;
        return {
          id: a.id,
          cohortId: a.cohortId,
          title: a.title,
          description: a.description,
          status: a.status,
          deadline: a.deadline,
          config: {
            sessionMode: config.sessionMode,
            difficulty: config.difficulty,
            targetScore: config.targetScore,
          },
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        };
      }

      const completedSessions = a.sessions || [];
      const completedCandidates = completedSessions.length;
      let averageScore: number | null = null;
      if (completedCandidates > 0) {
        const sum = completedSessions.reduce(
          (acc: number, session: { overallScore?: number | null }) =>
            acc + (session.overallScore || 0),
          0,
        );
        averageScore = Number((sum / completedCandidates).toFixed(1));
      }

      return {
        id: a.id,
        cohortId: a.cohortId,
        title: a.title,
        description: a.description,
        status: a.status,
        deadline: a.deadline,
        config: a.config,
        totalCandidates: cohort.members.length,
        completedCandidates,
        averageScore,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      };
    });
  }
}
