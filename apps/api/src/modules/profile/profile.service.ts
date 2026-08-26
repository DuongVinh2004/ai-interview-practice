import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import {
  ErrorCode,
  UserRole,
  UserStatus,
  CompetencyArea,
  CompetencyBenchmarkResponse,
  UserDataExport,
  SessionState,
} from '@ai-interview/contracts';
import { UpdateProfileRequestDto } from './dto/profile.dto';

const BENCHMARKS_BY_LEVEL: Record<string, Record<CompetencyArea, number>> = {
  junior: {
    [CompetencyArea.LANGUAGE_CORE]: 6.5,
    [CompetencyArea.DATABASE_CONCURRENCY]: 5.5,
    [CompetencyArea.SYSTEM_DESIGN]: 5.0,
    [CompetencyArea.ARCHITECTURE_PATTERNS]: 5.0,
    [CompetencyArea.RESILIENCE_SECURITY]: 5.0,
  },
  middle: {
    [CompetencyArea.LANGUAGE_CORE]: 7.5,
    [CompetencyArea.DATABASE_CONCURRENCY]: 7.0,
    [CompetencyArea.SYSTEM_DESIGN]: 7.0,
    [CompetencyArea.ARCHITECTURE_PATTERNS]: 7.0,
    [CompetencyArea.RESILIENCE_SECURITY]: 6.5,
  },
  senior: {
    [CompetencyArea.LANGUAGE_CORE]: 8.5,
    [CompetencyArea.DATABASE_CONCURRENCY]: 8.0,
    [CompetencyArea.SYSTEM_DESIGN]: 8.5,
    [CompetencyArea.ARCHITECTURE_PATTERNS]: 8.5,
    [CompetencyArea.RESILIENCE_SECURITY]: 8.0,
  },
  lead: {
    [CompetencyArea.LANGUAGE_CORE]: 9.0,
    [CompetencyArea.DATABASE_CONCURRENCY]: 8.5,
    [CompetencyArea.SYSTEM_DESIGN]: 9.0,
    [CompetencyArea.ARCHITECTURE_PATTERNS]: 9.0,
    [CompetencyArea.RESILIENCE_SECURITY]: 8.5,
  },
};

const COMPETENCY_META: Record<CompetencyArea, { name: string; recommendationTemplate: string }> = {
  [CompetencyArea.SYSTEM_DESIGN]: {
    name: 'System Design & Scalability',
    recommendationTemplate:
      'Practice distributed trade-offs, caching hierarchies, and partition strategies.',
  },
  [CompetencyArea.LANGUAGE_CORE]: {
    name: 'Core Language & Concurrency',
    recommendationTemplate:
      'Deep dive into asynchronous runtimes, memory management, and typing semantics.',
  },
  [CompetencyArea.DATABASE_CONCURRENCY]: {
    name: 'Database & Transaction Isolation',
    recommendationTemplate:
      'Focus on MVCC, deadlock mitigation, indexing strategies, and read/write replicas.',
  },
  [CompetencyArea.ARCHITECTURE_PATTERNS]: {
    name: 'Software Architecture & Modular Monoliths',
    recommendationTemplate:
      'Master DDD boundaries, hexagonal architectures, and event-driven choreography.',
  },
  [CompetencyArea.RESILIENCE_SECURITY]: {
    name: 'Resilience, Circuit Breakers & Security',
    recommendationTemplate:
      'Study rate-limiting, token replay prevention, and fault isolation patterns.',
  },
};

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, email: true, role: true, status: true, createdAt: true },
        },
      },
    });

    if (!profile) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Profile not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.fullName,
      targetRole: profile.targetRole,
      targetLevel: profile.targetLevel,
      bio: profile.bio,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      user: {
        id: profile.user.id,
        email: profile.user.email,
        role: profile.user.role,
        status: profile.user.status,
        createdAt: profile.user.createdAt.toISOString(),
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileRequestDto) {
    const updated = await this.prisma.userProfile.upsert({
      where: { userId },
      update: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.targetRole !== undefined ? { targetRole: dto.targetRole.trim() } : {}),
        ...(dto.targetLevel !== undefined ? { targetLevel: dto.targetLevel.trim() } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio.trim() } : {}),
      },
      create: {
        userId,
        fullName: dto.fullName?.trim() || 'Candidate',
        targetRole: dto.targetRole?.trim(),
        targetLevel: dto.targetLevel?.trim() || 'Senior',
        bio: dto.bio?.trim(),
      },
      include: {
        user: {
          select: { id: true, email: true, role: true, status: true, createdAt: true },
        },
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      fullName: updated.fullName,
      targetRole: updated.targetRole,
      targetLevel: updated.targetLevel,
      bio: updated.bio,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      user: {
        id: updated.user.id,
        email: updated.user.email,
        role: updated.user.role,
        status: updated.user.status,
        createdAt: updated.user.createdAt.toISOString(),
      },
    };
  }

  async getBenchmarks(userId: string): Promise<CompetencyBenchmarkResponse> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    const targetLevelStr = (profile?.targetLevel || 'Senior').toLowerCase();
    const benchmarkTier = BENCHMARKS_BY_LEVEL[targetLevelStr] || BENCHMARKS_BY_LEVEL['senior'];

    // Retrieve all evaluated turns with answer evaluations
    const sessions = await this.prisma.interviewSession.findMany({
      where: {
        userId,
        turns: { some: { answer: { evaluation: { isNot: null } } } },
      },
      include: {
        turns: {
          where: { answer: { evaluation: { isNot: null } } },
          include: {
            question: true,
            answer: { include: { evaluation: true } },
          },
        },
      },
    });

    // Tally scores by competency area
    const scoresByCompetency: Record<CompetencyArea, number[]> = {
      [CompetencyArea.SYSTEM_DESIGN]: [],
      [CompetencyArea.LANGUAGE_CORE]: [],
      [CompetencyArea.DATABASE_CONCURRENCY]: [],
      [CompetencyArea.ARCHITECTURE_PATTERNS]: [],
      [CompetencyArea.RESILIENCE_SECURITY]: [],
    };

    let totalTurnsCount = 0;
    const allScores: number[] = [];

    for (const session of sessions) {
      for (const turn of session.turns) {
        const evalObj = turn.answer?.evaluation;
        if (!evalObj) continue;

        totalTurnsCount++;
        allScores.push(evalObj.score);

        // Assign turn score to relevant competency area
        let targetArea: CompetencyArea =
          (session.competencyArea as unknown as CompetencyArea) || CompetencyArea.SYSTEM_DESIGN;
        const keyFocus = turn.question?.keyFocus?.toLowerCase() || '';

        if (
          keyFocus.includes('sql') ||
          keyFocus.includes('transaction') ||
          keyFocus.includes('isolation') ||
          keyFocus.includes('database') ||
          keyFocus.includes('lock')
        ) {
          targetArea = CompetencyArea.DATABASE_CONCURRENCY;
        } else if (
          keyFocus.includes('security') ||
          keyFocus.includes('circuit') ||
          keyFocus.includes('resilience') ||
          keyFocus.includes('rate')
        ) {
          targetArea = CompetencyArea.RESILIENCE_SECURITY;
        } else if (
          keyFocus.includes('pattern') ||
          keyFocus.includes('architecture') ||
          keyFocus.includes('monolith')
        ) {
          targetArea = CompetencyArea.ARCHITECTURE_PATTERNS;
        } else if (
          keyFocus.includes('async') ||
          keyFocus.includes('memory') ||
          keyFocus.includes('type') ||
          keyFocus.includes('event loop')
        ) {
          targetArea = CompetencyArea.LANGUAGE_CORE;
        }

        scoresByCompetency[targetArea].push(evalObj.score);
      }
    }

    const areas = Object.values(CompetencyArea);
    const benchmarkItems = areas.map(compArea => {
      const samples = scoresByCompetency[compArea];
      const benchmarkScore = benchmarkTier[compArea];
      const userScore =
        samples.length > 0
          ? Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10
          : 0;

      const gap = Math.round((userScore - benchmarkScore) * 10) / 10;
      let status: 'EXCEEDS' | 'MEETS' | 'GROWTH_REQUIRED' = 'GROWTH_REQUIRED';
      if (userScore >= benchmarkScore) {
        status = 'EXCEEDS';
      } else if (userScore >= benchmarkScore - 1.0) {
        status = 'MEETS';
      }

      return {
        competency: compArea,
        name: COMPETENCY_META[compArea].name,
        userScore,
        benchmarkScore,
        gap,
        status,
        recommendation: COMPETENCY_META[compArea].recommendationTemplate,
      };
    });

    const userAvg =
      allScores.length > 0
        ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
        : 0;

    const benchmarkAvg =
      Math.round(
        (Object.values(benchmarkTier).reduce((a, b) => a + b, 0) /
          Object.values(benchmarkTier).length) *
          10,
      ) / 10;

    const readinessPercentage =
      benchmarkAvg > 0 ? Math.min(100, Math.round((userAvg / benchmarkAvg) * 100)) : 0;

    const topStrengths = benchmarkItems
      .filter(b => b.status === 'EXCEEDS' || (b.userScore >= 7.5 && b.userScore > 0))
      .map(b => b.name);

    const priorityGaps = benchmarkItems
      .filter(b => b.status === 'GROWTH_REQUIRED' || b.userScore < b.benchmarkScore)
      .map(b => b.name);

    const summary =
      readinessPercentage >= 90
        ? `Outstanding technical proficiency! Your performance consistently meets or exceeds the industry expectations for a ${profile?.targetLevel || 'Senior'} level.`
        : readinessPercentage >= 75
          ? `Solid technical foundation. You are close to full readiness for ${profile?.targetLevel || 'Senior'} roles, with actionable focus areas in ${priorityGaps.slice(0, 2).join(' and ') || 'advanced patterns'}.`
          : `Emerging technical readiness. Target focused remediation sessions in ${priorityGaps.slice(0, 2).join(' and ') || 'core domains'} to reach industry target.`;

    return {
      userId,
      targetLevel: profile?.targetLevel || 'Senior',
      evaluatedTurnsCount: totalTurnsCount,
      overallReadinessScore: userAvg,
      readinessPercentage,
      benchmarks: benchmarkItems,
      topStrengths,
      priorityGaps,
      summary,
    };
  }

  async exportUserData(userId: string): Promise<UserDataExport> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        sessions: {
          orderBy: { createdAt: 'desc' },
          include: {
            jobRole: true,
            seniorityLevel: true,
            technologies: { include: { technology: true } },
            turns: {
              orderBy: { turnNumber: 'asc' },
              include: {
                question: true,
                answer: { include: { evaluation: true } },
              },
            },
            learningPath: {
              include: {
                items: { orderBy: { order: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const completedSessions = user.sessions.filter(s => s.state === SessionState.COMPLETED);
    const validScores = user.sessions
      .map(s => s.overallScore)
      .filter((s): s is number => typeof s === 'number');

    const averageScore =
      validScores.length > 0
        ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
        : null;

    let evaluatedTurnsCount = 0;
    user.sessions.forEach(s => {
      s.turns.forEach(t => {
        if (t.answer?.evaluation) evaluatedTurnsCount++;
      });
    });

    const documents = await this.prisma.userDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      exportedAt: new Date().toISOString(),
      gdprComplianceVersion: 'GDPR-AIP-2026.08',
      manifestVersion: '1.0.0',
      retentionPolicySummary: {
        cvRetentionDays: 30,
        voiceRetentionDays: 30,
        sessionRetentionDays: 730,
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role as unknown as UserRole,
        status: user.status as unknown as UserStatus,
        createdAt: user.createdAt.toISOString(),
      },
      profile: {
        fullName: user.profile?.fullName || 'Candidate',
        targetRole: user.profile?.targetRole || null,
        targetLevel: user.profile?.targetLevel || null,
        bio: user.profile?.bio || null,
      },
      documents: documents.map(d => ({
        id: d.id,
        fileName: d.fileName,
        fileType: d.fileType,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
        expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
      })),
      sessions: user.sessions.map(s => ({
        id: s.id,
        userId: s.userId,
        state: s.state as unknown as SessionState,
        sessionMode: s.sessionMode as unknown as any,
        competencyArea: (s.competencyArea as unknown as CompetencyArea) || null,
        isSandbox: s.isSandbox,
        currentTurn: s.currentTurn,
        totalTurns: s.totalTurns,
        targetDifficulty: s.targetDifficulty as any,
        overallScore: s.overallScore,
        jobRole: {
          id: s.jobRole.id,
          slug: s.jobRole.slug,
          name: s.jobRole.name,
          description: s.jobRole.description,
          isActive: s.jobRole.isActive,
        },
        seniorityLevel: {
          id: s.seniorityLevel.id,
          slug: s.seniorityLevel.slug,
          name: s.seniorityLevel.name,
          order: s.seniorityLevel.order,
          description: s.seniorityLevel.description,
          isActive: s.seniorityLevel.isActive,
        },
        technologies: s.technologies.map(st => ({
          id: st.technology.id,
          slug: st.technology.slug,
          name: st.technology.name,
          category: st.technology.category,
          isActive: st.technology.isActive,
        })),
        turns: s.turns.map(t => ({
          id: t.id,
          sessionId: t.sessionId,
          turnNumber: t.turnNumber,
          difficulty: t.difficulty as any,
          status: t.status as any,
          isFollowUp: t.isFollowUp,
          parentTurnNumber: t.parentTurnNumber,
          question: t.question
            ? {
                id: t.question.id,
                turnId: t.question.turnId,
                content: t.question.content,
                difficulty: t.question.difficulty as any,
                keyFocus: t.question.keyFocus,
                createdAt: t.question.createdAt.toISOString(),
              }
            : null,
          answer: t.answer
            ? {
                id: t.answer.id,
                turnId: t.answer.turnId,
                content: t.answer.content,
                submittedAt: t.answer.submittedAt.toISOString(),
                evaluation: t.answer.evaluation
                  ? {
                      id: t.answer.evaluation.id,
                      answerId: t.answer.evaluation.answerId,
                      score: t.answer.evaluation.score,
                      rubricScores: t.answer.evaluation.rubricScores as any,
                      strengths: t.answer.evaluation.strengths as any,
                      improvements: t.answer.evaluation.improvements as any,
                      conciseFeedback: t.answer.evaluation.conciseFeedback,
                      evidence: t.answer.evaluation.evidence as any,
                      createdAt: t.answer.evaluation.createdAt.toISOString(),
                    }
                  : null,
              }
            : null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
        learningPath: s.learningPath
          ? {
              id: s.learningPath.id,
              sessionId: s.learningPath.sessionId,
              status: s.learningPath.status,
              summary: s.learningPath.summary,
              errorMessage: s.learningPath.errorMessage,
              items: s.learningPath.items.map(item => ({
                id: item.id,
                learningPathId: item.learningPathId,
                gap: item.gap,
                topic: item.topic,
                priority: item.priority as any,
                recommendedAction: item.recommendedAction,
                searchKeywords: item.searchKeywords as any,
                order: item.order,
                isCompleted: item.isCompleted,
                completedAt: item.completedAt ? item.completedAt.toISOString() : null,
              })),
              createdAt: s.learningPath.createdAt.toISOString(),
              updatedAt: s.learningPath.updatedAt.toISOString(),
            }
          : null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })) as any,
      summary: {
        totalSessionsCount: user.sessions.length,
        completedSessionsCount: completedSessions.length,
        totalEvaluatedTurns: evaluatedTurnsCount,
        averageScore,
      },
    };
  }

  async deleteAccount(userId: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // GDPR Right to Erasure / Account deletion workflow (PRIV-002)
    await this.prisma.$transaction(async tx => {
      // 1. Scrub PII from user profile
      if (user.profile) {
        await tx.userProfile.update({
          where: { userId },
          data: {
            fullName: 'Deleted User',
            bio: null,
          },
        });
      }

      // 2. Anonymize user record and set status to LOCKED
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.LOCKED,
          email: `deleted_${userId}@anonymized.local`,
          passwordHash: 'DELETED',
        },
      });

      // 3. Purge user documents
      await tx.userDocument.deleteMany({
        where: { userId },
      });

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'USER_ACCOUNT_DELETED' as any,
          resource: 'user',
          resourceId: userId,
          details: { reason: 'GDPR Right to Erasure user-initiated account deletion' },
        },
      });
    });

    return {
      success: true,
      message: 'User account and personal data successfully deleted and anonymized.',
    };
  }
}
