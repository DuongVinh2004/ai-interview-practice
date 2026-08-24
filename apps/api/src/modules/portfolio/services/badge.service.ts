import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CompetencyArea, BadgeLevel } from '@ai-interview/contracts';

export interface BadgeTierRule {
  level: BadgeLevel;
  minScore: number;
  minEvidence: number;
}

export const BADGE_TIER_RULES: BadgeTierRule[] = [
  { level: BadgeLevel.PLATINUM, minScore: 9.0, minEvidence: 12 },
  { level: BadgeLevel.GOLD, minScore: 8.0, minEvidence: 8 },
  { level: BadgeLevel.SILVER, minScore: 6.5, minEvidence: 5 },
  { level: BadgeLevel.BRONZE, minScore: 5.0, minEvidence: 3 },
];

export const AREA_LABELS: Record<CompetencyArea, string> = {
  [CompetencyArea.SYSTEM_DESIGN]: 'System Design & Scalability',
  [CompetencyArea.LANGUAGE_CORE]: 'Language Core & OOP',
  [CompetencyArea.DATABASE_CONCURRENCY]: 'Database & Concurrency',
  [CompetencyArea.ARCHITECTURE_PATTERNS]: 'Architecture & Design Patterns',
  [CompetencyArea.RESILIENCE_SECURITY]: 'Resilience & Security',
};

@Injectable()
export class BadgeService {
  constructor(private readonly prisma: PrismaService) {}

  calculateUnlockedBadge(score: number, evidenceCount: number): BadgeLevel | null {
    for (const rule of BADGE_TIER_RULES) {
      if (score >= rule.minScore && evidenceCount >= rule.minEvidence) {
        return rule.level;
      }
    }
    return null;
  }

  getNextBadgeTarget(currentLevel: BadgeLevel | null): { level: BadgeLevel; minScore: number; minEvidence: number } | null {
    if (!currentLevel) {
      return { level: BadgeLevel.BRONZE, minScore: 5.0, minEvidence: 3 };
    }
    if (currentLevel === BadgeLevel.BRONZE) {
      return { level: BadgeLevel.SILVER, minScore: 6.5, minEvidence: 5 };
    }
    if (currentLevel === BadgeLevel.SILVER) {
      return { level: BadgeLevel.GOLD, minScore: 8.0, minEvidence: 8 };
    }
    if (currentLevel === BadgeLevel.GOLD) {
      return { level: BadgeLevel.PLATINUM, minScore: 9.0, minEvidence: 12 };
    }
    return null;
  }

  async syncUserBadges(userId: string) {
    // 1. Fetch skill scores from SkillScore table
    const skillScores = await this.prisma.skillScore.findMany({
      where: { userId },
      include: { skillNode: true },
    });

    const areaMetrics: Record<CompetencyArea, { totalWeightedScore: number; totalWeight: number; totalEvidence: number }> = {
      [CompetencyArea.SYSTEM_DESIGN]: { totalWeightedScore: 0, totalWeight: 0, totalEvidence: 0 },
      [CompetencyArea.LANGUAGE_CORE]: { totalWeightedScore: 0, totalWeight: 0, totalEvidence: 0 },
      [CompetencyArea.DATABASE_CONCURRENCY]: { totalWeightedScore: 0, totalWeight: 0, totalEvidence: 0 },
      [CompetencyArea.ARCHITECTURE_PATTERNS]: { totalWeightedScore: 0, totalWeight: 0, totalEvidence: 0 },
      [CompetencyArea.RESILIENCE_SECURITY]: { totalWeightedScore: 0, totalWeight: 0, totalEvidence: 0 },
    };

    for (const ss of skillScores) {
      const area = ss.skillNode.competencyArea;
      if (area && areaMetrics[area]) {
        areaMetrics[area].totalWeightedScore += ss.weightedScore * ss.skillNode.weight;
        areaMetrics[area].totalWeight += ss.skillNode.weight;
        areaMetrics[area].totalEvidence += ss.evidenceCount;
      }
    }

    // Also look at completed turn evaluations for user if skillScores is empty
    if (skillScores.length === 0) {
      const turns = await this.prisma.interviewTurn.findMany({
        where: {
          session: { userId },
          status: 'EVALUATED',
          answer: { evaluation: { isNot: null } },
        },
        include: {
          session: true,
          answer: { include: { evaluation: true } },
        },
      });

      for (const t of turns) {
        const area = t.session.competencyArea || CompetencyArea.SYSTEM_DESIGN;
        if (areaMetrics[area] && t.answer?.evaluation) {
          areaMetrics[area].totalWeightedScore += t.answer.evaluation.score;
          areaMetrics[area].totalWeight += 1;
          areaMetrics[area].totalEvidence += 1;
        }
      }
    }

    const earnedBadges: Array<{ competencyArea: CompetencyArea; level: BadgeLevel; score: number; evidenceCount: number }> = [];

    for (const area of Object.values(CompetencyArea)) {
      const metrics = areaMetrics[area];
      const avgScore = metrics.totalWeight > 0 ? metrics.totalWeightedScore / metrics.totalWeight : 0;
      const evidence = metrics.totalEvidence;
      const unlockedLevel = this.calculateUnlockedBadge(avgScore, evidence);

      if (unlockedLevel) {
        // Upsert user badge
        const badge = await this.prisma.userBadge.upsert({
          where: {
            userId_competencyArea_level: {
              userId,
              competencyArea: area as any,
              level: unlockedLevel as any,
            },
          },
          update: {
            score: Number(avgScore.toFixed(1)),
            evidenceCount: evidence,
          },
          create: {
            userId,
            competencyArea: area as any,
            level: unlockedLevel as any,
            score: Number(avgScore.toFixed(1)),
            evidenceCount: evidence,
          },
        });
        earnedBadges.push({
          competencyArea: badge.competencyArea as unknown as CompetencyArea,
          level: badge.level as unknown as BadgeLevel,
          score: badge.score,
          evidenceCount: badge.evidenceCount,
        });
      }
    }

    return earnedBadges;
  }

  async getUserBadgeProgress(userId: string) {
    await this.syncUserBadges(userId);

    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId },
    });

    const badgeByArea = new Map<CompetencyArea, (typeof userBadges)[0]>();
    for (const b of userBadges) {
      const area = b.competencyArea as unknown as CompetencyArea;
      const existing = badgeByArea.get(area);
      if (!existing || this.getLevelRank(b.level as unknown as BadgeLevel) > this.getLevelRank(existing.level as unknown as BadgeLevel)) {
        badgeByArea.set(area, b);
      }
    }

    // Return progress across all 5 areas
    return Object.values(CompetencyArea).map((area) => {
      const badge = badgeByArea.get(area);
      const currentLevel = (badge?.level as unknown as BadgeLevel) || null;
      const currentScore = badge?.score || 0;
      const currentEvidence = badge?.evidenceCount || 0;
      const nextTarget = this.getNextBadgeTarget(currentLevel);

      let progressPercentage = 0;
      if (currentLevel === BadgeLevel.PLATINUM) {
        progressPercentage = 100;
      } else if (nextTarget) {
        const scoreProgress = Math.min(currentScore / nextTarget.minScore, 1.0);
        const evidenceProgress = Math.min(currentEvidence / nextTarget.minEvidence, 1.0);
        progressPercentage = Math.round(((scoreProgress + evidenceProgress) / 2) * 100);
      }

      return {
        competencyArea: area,
        areaName: AREA_LABELS[area] || area,
        highestLevel: currentLevel,
        currentScore,
        evidenceCount: currentEvidence,
        nextBadgeLevel: nextTarget?.level || null,
        requiredScore: nextTarget?.minScore || null,
        requiredEvidence: nextTarget?.minEvidence || null,
        progressPercentage,
        isUnlocked: !!currentLevel,
        earnedAt: badge?.earnedAt ? badge.earnedAt.toISOString() : null,
      };
    });
  }

  private getLevelRank(level: BadgeLevel): number {
    switch (level) {
      case BadgeLevel.BRONZE:
        return 1;
      case BadgeLevel.SILVER:
        return 2;
      case BadgeLevel.GOLD:
        return 3;
      case BadgeLevel.PLATINUM:
        return 4;
      default:
        return 0;
    }
  }
}
