import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { ErrorCode, UserRole, SessionState, SessionMode } from '@ai-interview/contracts';

export interface HistoryFilterOptions {
  page?: number;
  limit?: number;
  state?: SessionState;
  jobRoleId?: string;
  sessionMode?: SessionMode;
  search?: string;
  minScore?: number;
  maxScore?: number;
}

@Injectable()
export class HistoryReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistory(userId: string, options: HistoryFilterOptions) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (options.state) {
      where.state = options.state;
    }
    if (options.jobRoleId) {
      where.jobRoleId = options.jobRoleId;
    }
    if (options.sessionMode) {
      where.sessionMode = options.sessionMode;
    }
    if (options.minScore !== undefined || options.maxScore !== undefined) {
      where.overallScore = {};
      if (options.minScore !== undefined) where.overallScore.gte = options.minScore;
      if (options.maxScore !== undefined) where.overallScore.lte = options.maxScore;
    }
    if (options.search && options.search.trim()) {
      const q = options.search.trim();
      where.OR = [
        { jobRole: { name: { contains: q, mode: 'insensitive' } } },
        { seniorityLevel: { name: { contains: q, mode: 'insensitive' } } },
        {
          technologies: {
            some: {
              technology: {
                name: { contains: q, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }

    const [total, sessions] = await Promise.all([
      this.prisma.interviewSession.count({ where }),
      this.prisma.interviewSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          jobRole: true,
          seniorityLevel: true,
          technologies: { include: { technology: true } },
          _count: { select: { turns: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: sessions.map(s => ({
        id: s.id,
        state: s.state,
        sessionMode: s.sessionMode,
        competencyArea: s.competencyArea,
        isSandbox: s.isSandbox,
        currentTurn: s.currentTurn,
        totalTurns: s.totalTurns,
        targetDifficulty: s.targetDifficulty,
        overallScore: s.overallScore,
        completedAt: s.completedAt?.toISOString() || null,
        createdAt: s.createdAt.toISOString(),
        jobRole: s.jobRole,
        seniorityLevel: s.seniorityLevel,
        technologies: s.technologies.map(t => t.technology),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getSessionResult(userId: string, userRole: UserRole, sessionId: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        jobRole: true,
        seniorityLevel: true,
        technologies: { include: { technology: true } },
        turns: {
          orderBy: { turnNumber: 'asc' },
          include: {
            question: true,
            answer: {
              include: { evaluation: true },
            },
          },
        },
        learningPath: {
          include: {
            items: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!session) {
      throw new DomainException(
        ErrorCode.SESSION_NOT_FOUND,
        'Interview session not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (session.userId !== userId && userRole !== UserRole.ADMIN) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have permission to view this interview result',
        HttpStatus.FORBIDDEN,
      );
    }

    // Prefer reviewed/authoritative evaluations, but keep mock/dev sessions useful when
    // every evaluation is awaiting review.
    const turnsWithEval = session.turns.filter(t => t.answer?.evaluation);
    const authoritativeTurns = turnsWithEval.filter(
      t => t.answer!.evaluation!.authorityState === 'AUTHORITATIVE',
    );
    const scoreableTurns = authoritativeTurns.length > 0 ? authoritativeTurns : turnsWithEval;
    let avgAccuracy = 0;
    let avgDepth = 0;
    let avgClarity = 0;

    if (scoreableTurns.length > 0) {
      let totalAcc = 0;
      let totalDepth = 0;
      let totalClarity = 0;

      for (const t of scoreableTurns) {
        const rubric = t.answer!.evaluation!.rubricScores as any;
        if (rubric) {
          totalAcc += rubric.technicalAccuracy ?? 0;
          totalDepth += rubric.depth ?? 0;
          totalClarity += rubric.clarity ?? 0;
        }
      }

      avgAccuracy = Number((totalAcc / scoreableTurns.length).toFixed(1));
      avgDepth = Number((totalDepth / scoreableTurns.length).toFixed(1));
      avgClarity = Number((totalClarity / scoreableTurns.length).toFixed(1));
    }

    const effectiveOverallScore =
      scoreableTurns.length > 0
        ? Number(
            (
              scoreableTurns.reduce((sum, t) => sum + t.answer!.evaluation!.score, 0) /
              scoreableTurns.length
            ).toFixed(1),
          )
        : session.overallScore;

    const learningPathSummary = session.learningPath?.summary?.replace(
      /overall performance score of \d+(?:\.\d+)?\/10/i,
      `overall performance score of ${effectiveOverallScore?.toFixed(1) ?? '0.0'}/10`,
    );

    return {
      sessionId: session.id,
      state: session.state,
      overallScore: effectiveOverallScore,
      completedAt: session.completedAt?.toISOString() || null,
      jobRole: session.jobRole,
      seniorityLevel: session.seniorityLevel,
      technologies: session.technologies.map(t => t.technology),
      rubricAverages: {
        technicalAccuracy: avgAccuracy,
        depth: avgDepth,
        clarity: avgClarity,
      },
      turns: session.turns.map(t => ({
        turnNumber: t.turnNumber,
        difficulty: t.difficulty,
        status: t.status,
        question: t.question
          ? {
              content: t.question.content,
              keyFocus: t.question.keyFocus,
            }
          : null,
        answer: t.answer
          ? {
              content: t.answer.content,
              submittedAt: t.answer.submittedAt
                ? t.answer.submittedAt.toISOString()
                : new Date().toISOString(),
              evaluation: t.answer.evaluation
                ? {
                    score: t.answer.evaluation.score,
                    rubricScores: t.answer.evaluation.rubricScores,
                    strengths: t.answer.evaluation.strengths,
                    improvements: t.answer.evaluation.improvements,
                    conciseFeedback: t.answer.evaluation.conciseFeedback,
                    evidence: t.answer.evaluation.evidence,
                  }
                : null,
            }
          : null,
      })),
      learningPath: session.learningPath
        ? {
            id: session.learningPath.id,
            status: session.learningPath.status,
            summary: learningPathSummary,
            items: session.learningPath.items.map(item => ({
              id: item.id,
              gap: item.gap,
              topic: item.topic,
              priority: item.priority,
              recommendedAction: item.recommendedAction,
              searchKeywords: item.searchKeywords,
              order: item.order,
              isCompleted: item.isCompleted,
              completedAt: item.completedAt?.toISOString() || null,
            })),
          }
        : null,
    };
  }
}
