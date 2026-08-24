import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';

export interface TierInfo {
  slug: string;
  name: string;
  nameVi: string;
  badgeColor: string;
  minScore: number;
}

@Injectable()
export class TierClassificationService {
  public static readonly TIERS: TierInfo[] = [
    {
      slug: 'tier-3',
      name: 'Big Tech Ready (L5/L6)',
      nameVi: 'Sẵn sàng Big Tech',
      badgeColor: 'emerald',
      minScore: 85.0,
    },
    {
      slug: 'tier-2',
      name: 'Competitive Offer Ready (L4/L5)',
      nameVi: 'Cạnh tranh Offer Cao',
      badgeColor: 'indigo',
      minScore: 70.0,
    },
    {
      slug: 'tier-1',
      name: 'Emerging Candidate (L3/L4)',
      nameVi: 'Tiềm năng Đang Phát triển',
      badgeColor: 'amber',
      minScore: 50.0,
    },
    {
      slug: 'tier-0',
      name: 'Needs Practice Foundation',
      nameVi: 'Cần Luyện tập Cơ bản',
      badgeColor: 'rose',
      minScore: 0.0,
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determine Tier based on Readiness Score
   */
  classifyTier(readinessScore: number): TierInfo {
    for (const tier of TierClassificationService.TIERS) {
      if (readinessScore >= tier.minScore) {
        return tier;
      }
    }
    return TierClassificationService.TIERS[TierClassificationService.TIERS.length - 1];
  }

  async getAllTiers() {
    const dbTiers = await this.prisma.tierDefinition.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    if (dbTiers.length > 0) {
      return dbTiers;
    }

    return TierClassificationService.TIERS;
  }
}
