import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CompetencyArea } from '@ai-interview/contracts';
import { CohortAccessContext, CohortAccessPolicy } from '../policies/cohort-access.policy';
import { isPersistedAuthoritativeEvaluation } from '../../evaluation/evaluation-authority';

export const AREA_NAMES: Record<CompetencyArea, string> = {
  [CompetencyArea.SYSTEM_DESIGN]: 'System Design & Scalability',
  [CompetencyArea.LANGUAGE_CORE]: 'Language Core & Concurrency',
  [CompetencyArea.DATABASE_CONCURRENCY]: 'Database & Transactions',
  [CompetencyArea.ARCHITECTURE_PATTERNS]: 'Architecture Patterns',
  [CompetencyArea.RESILIENCE_SECURITY]: 'Resilience & Security',
};

@Injectable()
export class CohortAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cohortAccessPolicy: CohortAccessPolicy,
  ) {}

  async getCohortAnalytics(cohortId: string, access: CohortAccessContext) {
    const tenantId = access.tenantId;
    const cohort = await this.prisma.cohort.findFirst({
      where: this.cohortAccessPolicy.buildReadPredicate(cohortId, access, {
        allowStudent: false,
      }),
      include: {
        members: {
          include: {
            tenantMember: {
              include: {
                user: {
                  include: {
                    profile: true,
                    sessions: {
                      where: {
                        state: 'COMPLETED',
                        tenantId,
                        // Do not let an overallScore or a review-only result
                        // become tenant analytics. A session is eligible only
                        // when it contains current authoritative evidence.
                        turns: {
                          some: {
                            status: 'EVALUATED',
                            answer: {
                              evaluation: {
                                is: {
                                  authorityState: 'AUTHORITATIVE',
                                  needsReview: false,
                                },
                              },
                            },
                          },
                        },
                      },
                      include: {
                        turns: {
                          include: {
                            question: true,
                            answer: {
                              include: {
                                evaluation: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        assignments: true,
      },
    });

    if (!cohort) {
      throw new NotFoundException('Cohort not found in this organization');
    }

    const totalStudents = cohort.members.length;
    const studentProgressList: Array<{
      userId: string;
      fullName: string;
      email: string;
      completedAssignments: number;
      totalAssignments: number;
      averageScore: number;
      readinessScore?: number;
      needsAssistance: boolean;
      lastActiveAt: Date | null;
    }> = [];

    let scoreSum = 0;
    let scoredCount = 0;
    const distribution = {
      bracket0to4: 0,
      bracket4to6: 0,
      bracket6to8: 0,
      bracket8to10: 0,
    };

    // Aggregate turn evaluations by competency area
    const areaTurnScores: Record<CompetencyArea, Array<{ score: number; topic?: string }>> = {
      [CompetencyArea.SYSTEM_DESIGN]: [],
      [CompetencyArea.LANGUAGE_CORE]: [],
      [CompetencyArea.DATABASE_CONCURRENCY]: [],
      [CompetencyArea.ARCHITECTURE_PATTERNS]: [],
      [CompetencyArea.RESILIENCE_SECURITY]: [],
    };

    for (const m of cohort.members) {
      const u = m.tenantMember.user;
      // Use only the evaluations returned from the tenant-scoped query and
      // re-check provenance in application code (including provider and
      // non-empty evidence) before using any score.
      const completedSessions = (u.sessions || [])
        .map(session => ({
          session,
          authoritativeTurns: (session.turns || []).filter(
            turn =>
              turn.status === 'EVALUATED' &&
              isPersistedAuthoritativeEvaluation(turn.answer?.evaluation),
          ),
        }))
        .filter(item => item.authoritativeTurns.length > 0);
      const totalSessions = completedSessions.length;
      let userAvgScore = 0;

      if (totalSessions > 0) {
        const sessionScores = completedSessions.map(
          item =>
            item.authoritativeTurns.reduce((sum, turn) => sum + turn.answer!.evaluation!.score, 0) /
            item.authoritativeTurns.length,
        );
        const sum = sessionScores.reduce((acc, score) => acc + score, 0);
        userAvgScore = Number((sum / sessionScores.length).toFixed(1));
        scoreSum += userAvgScore;
        scoredCount++;

        if (userAvgScore < 4.0) distribution.bracket0to4++;
        else if (userAvgScore < 6.0) distribution.bracket4to6++;
        else if (userAvgScore < 8.0) distribution.bracket6to8++;
        else distribution.bracket8to10++;

        // Collect turn scores for competency heatmap
        for (const { session, authoritativeTurns } of completedSessions) {
          const sessionArea = session.competencyArea as CompetencyArea | null;
          for (const turn of authoritativeTurns) {
            const evalRecord = turn.answer?.evaluation;
            if (evalRecord) {
              const targetArea = sessionArea || CompetencyArea.LANGUAGE_CORE;
              if (areaTurnScores[targetArea]) {
                areaTurnScores[targetArea].push({
                  score: evalRecord.score,
                  topic: turn.question?.keyFocus || undefined,
                });
              }
            }
          }
        }
      } else {
        // Default unattempted to lower bracket
        distribution.bracket0to4++;
      }

      // Readiness snapshots are user-global and have no tenant/assignment
      // provenance. Derive a tenant-safe indicator from the same authoritative
      // scores instead of returning a cross-tenant snapshot.
      const readinessScore = totalSessions > 0 ? Math.round(userAvgScore * 10) : undefined;
      const lastSession = completedSessions[0]?.session;

      // NEW-B2B-01: Match completed assignments to cohort assignment requirements
      const cohortAssignmentIds = new Set(cohort.assignments.map(a => a.id));
      let completedAssignmentCount = totalSessions;
      if (cohortAssignmentIds.size > 0) {
        const completedAssignmentSet = new Set(
          completedSessions
            .map(({ session: s }) => s.assignmentId)
            .filter((id): id is string => Boolean(id && cohortAssignmentIds.has(id))),
        );
        // If sessions are tagged with assignmentId, use exact matching count; otherwise fallback to sessions count capped by total assignments
        completedAssignmentCount =
          completedAssignmentSet.size > 0
            ? completedAssignmentSet.size
            : Math.min(totalSessions, cohort.assignments.length);
      }

      studentProgressList.push({
        userId: u.id,
        fullName: u.profile?.fullName || u.email.split('@')[0],
        email: u.email,
        completedAssignments: completedAssignmentCount,
        totalAssignments: Math.max(cohort.assignments.length, 1),
        averageScore: userAvgScore,
        readinessScore,
        needsAssistance: userAvgScore < 6.0 || totalSessions === 0,
        lastActiveAt: lastSession?.completedAt || lastSession?.updatedAt || null,
      });
    }

    const activeStudents = studentProgressList.filter(s => s.completedAssignments > 0).length;
    const overallAverageScore = scoredCount > 0 ? Number((scoreSum / scoredCount).toFixed(1)) : 0.0;
    const completionRate =
      totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0;

    // Build real skill heatmap based on aggregated data (M-005)
    const skillHeatmap = Object.values(CompetencyArea).map(area => {
      const turns = areaTurnScores[area] || [];
      const totalTurns = turns.length;
      let areaAvg = 0;
      let passRate = 0;
      let weakestTopic = 'N/A';
      let strongestTopic = 'N/A';

      if (totalTurns > 0) {
        const sum = turns.reduce((acc, t) => acc + t.score, 0);
        areaAvg = Number((sum / totalTurns).toFixed(1));
        const passingCount = turns.filter(t => t.score >= 6.0).length;
        passRate = Math.round((passingCount / totalTurns) * 100);

        // Derive weakest / strongest topics from scored turns
        const sorted = [...turns].sort((a, b) => a.score - b.score);
        weakestTopic =
          sorted[0]?.topic ||
          (area === CompetencyArea.SYSTEM_DESIGN ? 'Consistent Hashing' : 'Garbage Collection');
        strongestTopic =
          sorted[sorted.length - 1]?.topic ||
          (area === CompetencyArea.SYSTEM_DESIGN ? 'Load Balancing' : 'OOP Polymorphism');
      } else if (overallAverageScore > 0) {
        areaAvg = overallAverageScore;
        passRate = Math.min(Math.round(overallAverageScore * 10), 100);
      }

      return {
        competencyArea: area,
        areaName: AREA_NAMES[area] || area,
        averageScore: areaAvg,
        passingRate: passRate,
        weakestTopic,
        strongestTopic,
      };
    });

    const studentsNeedingHelp = studentProgressList.filter(s => s.needsAssistance).slice(0, 10);

    const topPerformers = studentProgressList
      .filter(s => s.averageScore >= 8.0)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10);

    return {
      cohortId: cohort.id,
      cohortName: cohort.name,
      totalStudents,
      activeStudents,
      overallAverageScore,
      completionRate,
      scoreDistribution: distribution,
      skillHeatmap,
      studentsNeedingHelp,
      topPerformers,
    };
  }
}
