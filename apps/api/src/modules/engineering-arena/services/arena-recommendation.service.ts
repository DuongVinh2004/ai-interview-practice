import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ArenaChallengeRepository } from '../repositories/arena-challenge.repository';
import { ChallengeSummary, ArenaChallengeManifest } from '@ai-interview/contracts';

export interface ChallengeRecommendation {
  challenge: ChallengeSummary;
  targetSkill: string;
  reason: string;
  recommendedDifficulty: number;
}

@Injectable()
export class ArenaRecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly challengeRepo: ArenaChallengeRepository,
  ) {}

  async getRecommendedChallenges(userId: string): Promise<ChallengeRecommendation[]> {
    // 1. Fetch user recent skill evidences
    const evidences = await this.prisma.arenaSkillEvidence.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Compute average score per taxonomy key
    const skillScores = new Map<string, { total: number; count: number }>();
    for (const ev of evidences) {
      const current = skillScores.get(ev.taxonomyKey) || { total: 0, count: 0 };
      skillScores.set(ev.taxonomyKey, {
        total: current.total + ev.scoreContribution,
        count: current.count + 1,
      });
    }

    // Identify weak skills (average score < 70)
    const weakSkills = Array.from(skillScores.entries())
      .map(([key, data]) => ({ key, avg: data.total / data.count }))
      .filter(s => s.avg < 70)
      .sort((a, b) => a.avg - b.avg);

    // 2. Fetch all published challenges
    const publishedChallenges = await this.challengeRepo.listPublishedChallenges();

    // 3. Match challenges targeting weak skills or provide default progressive challenges
    const recommendations: ChallengeRecommendation[] = [];

    for (const challenge of publishedChallenges) {
      const activeVersion = challenge.versions[0];
      if (!activeVersion) continue;

      const manifest = activeVersion.manifestJson as unknown as ArenaChallengeManifest;
      const matchingWeakSkill = weakSkills.find(ws =>
        manifest.skills.some(s => s.taxonomyKey === ws.key),
      );

      if (matchingWeakSkill) {
        recommendations.push({
          challenge: {
            id: challenge.id,
            slug: challenge.slug,
            title: challenge.title,
            domain: challenge.domain as any,
            category: challenge.category as any,
            difficulty: challenge.difficulty,
            estimatedMinutes: challenge.estimatedMinutes,
            status: challenge.status as any,
            activeVersion: activeVersion.versionNumber,
            createdAt: challenge.createdAt.toISOString(),
            updatedAt: challenge.updatedAt.toISOString(),
          },
          targetSkill: matchingWeakSkill.key,
          reason: `Targeted remediation for ${matchingWeakSkill.key} (current avg score: ${Math.round(matchingWeakSkill.avg)}%)`,
          recommendedDifficulty: challenge.difficulty,
        });
      }
    }

    // If no weak skills or matching challenges, recommend next introductory/intermediate challenges
    if (recommendations.length === 0 && publishedChallenges.length > 0) {
      const first = publishedChallenges[0];
      if (first) {
        const activeVersion = first.versions[0];
        recommendations.push({
          challenge: {
            id: first.id,
            slug: first.slug,
            title: first.title,
            domain: first.domain as any,
            category: first.category as any,
            difficulty: first.difficulty,
            estimatedMinutes: first.estimatedMinutes,
            status: first.status as any,
            activeVersion: activeVersion?.versionNumber || 1,
            createdAt: first.createdAt.toISOString(),
            updatedAt: first.updatedAt.toISOString(),
          },
          targetSkill: 'general_engineering',
          reason: 'Recommended introductory challenge for overall engineering benchmark.',
          recommendedDifficulty: first.difficulty,
        });
      }
    }

    return recommendations;
  }
}
