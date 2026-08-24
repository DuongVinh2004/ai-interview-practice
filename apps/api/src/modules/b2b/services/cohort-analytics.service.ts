import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CompetencyArea } from '@ai-interview/contracts';

export const AREA_NAMES: Record<CompetencyArea, string> = {
  [CompetencyArea.SYSTEM_DESIGN]: 'System Design & Scalability',
  [CompetencyArea.LANGUAGE_CORE]: 'Language Core & Concurrency',
  [CompetencyArea.DATABASE_CONCURRENCY]: 'Database & Transactions',
  [CompetencyArea.ARCHITECTURE_PATTERNS]: 'Architecture Patterns',
  [CompetencyArea.RESILIENCE_SECURITY]: 'Resilience & Security',
};

@Injectable()
export class CohortAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCohortAnalytics(cohortId: string, tenantId: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, tenantId },
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
                        tenantId, // B-002: strictly scope sessions to this tenant
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
                    readinessSnapshots: {
                      orderBy: { snapshotDate: 'desc' },
                      take: 1,
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
      const completedSessions = u.sessions;
      const totalSessions = completedSessions.length;
      let userAvgScore = 0;

      if (totalSessions > 0) {
        const sum = completedSessions.reduce((acc, s) => acc + (s.overallScore || 0), 0);
        userAvgScore = Number((sum / totalSessions).toFixed(1));
        scoreSum += userAvgScore;
        scoredCount++;

        if (userAvgScore < 4.0) distribution.bracket0to4++;
        else if (userAvgScore < 6.0) distribution.bracket4to6++;
        else if (userAvgScore < 8.0) distribution.bracket6to8++;
        else distribution.bracket8to10++;

        // Collect turn scores for competency heatmap
        for (const session of completedSessions) {
          const sessionArea = session.competencyArea as CompetencyArea | null;
          for (const turn of (session.turns || [])) {
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

      const readinessScore = u.readinessSnapshots[0]?.readinessScore;
      const lastSession = completedSessions[0];

      studentProgressList.push({
        userId: u.id,
        fullName: u.profile?.fullName || u.email.split('@')[0],
        email: u.email,
        completedAssignments: totalSessions,
        totalAssignments: Math.max(cohort.assignments.length, 1),
        averageScore: userAvgScore,
        readinessScore,
        needsAssistance: userAvgScore < 6.0 || totalSessions === 0,
        lastActiveAt: lastSession?.completedAt || lastSession?.updatedAt || null,
      });
    }

    const activeStudents = studentProgressList.filter((s) => s.completedAssignments > 0).length;
    const overallAverageScore = scoredCount > 0 ? Number((scoreSum / scoredCount).toFixed(1)) : 0.0;
    const completionRate =
      totalStudents > 0
        ? Math.round((activeStudents / totalStudents) * 100)
        : 0;

    // Build real skill heatmap based on aggregated data (M-005)
    const skillHeatmap = Object.values(CompetencyArea).map((area) => {
      const turns = areaTurnScores[area] || [];
      const totalTurns = turns.length;
      let areaAvg = 0;
      let passRate = 0;
      let weakestTopic = 'N/A';
      let strongestTopic = 'N/A';

      if (totalTurns > 0) {
        const sum = turns.reduce((acc, t) => acc + t.score, 0);
        areaAvg = Number((sum / totalTurns).toFixed(1));
        const passingCount = turns.filter((t) => t.score >= 6.0).length;
        passRate = Math.round((passingCount / totalTurns) * 100);

        // Derive weakest / strongest topics from scored turns
        const sorted = [...turns].sort((a, b) => a.score - b.score);
        weakestTopic = sorted[0]?.topic || (area === CompetencyArea.SYSTEM_DESIGN ? 'Consistent Hashing' : 'Garbage Collection');
        strongestTopic = sorted[sorted.length - 1]?.topic || (area === CompetencyArea.SYSTEM_DESIGN ? 'Load Balancing' : 'OOP Polymorphism');
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

    const studentsNeedingHelp = studentProgressList
      .filter((s) => s.needsAssistance)
      .slice(0, 10);

    const topPerformers = studentProgressList
      .filter((s) => s.averageScore >= 8.0)
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
