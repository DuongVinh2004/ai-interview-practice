import { Test, TestingModule } from '@nestjs/testing';
import { ArenaRecommendationService } from './arena-recommendation.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ArenaChallengeRepository } from '../repositories/arena-challenge.repository';
import { ChallengeDomain, ChallengeCategory } from '@ai-interview/contracts';

describe('ArenaRecommendationService', () => {
  let service: ArenaRecommendationService;
  let prisma: {
    arenaSkillEvidence: { findMany: jest.Mock };
  };
  let challengeRepo: {
    listPublishedChallenges: jest.Mock;
  };

  const sampleChallenge = {
    id: 'c1',
    slug: 'fix-memory-leak',
    title: 'Fix Memory Leak',
    domain: ChallengeDomain.BACKEND,
    category: ChallengeCategory.BUG_FIX,
    difficulty: 3,
    estimatedMinutes: 30,
    status: 'PUBLISHED',
    createdAt: new Date('2026-08-28T00:00:00.000Z'),
    updatedAt: new Date('2026-08-28T00:00:00.000Z'),
    versions: [
      {
        versionNumber: 1,
        manifestJson: {
          skills: [{ taxonomyKey: 'nodejs_memory', weight: 1.0 }],
        },
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      arenaSkillEvidence: { findMany: jest.fn() },
    };

    challengeRepo = {
      listPublishedChallenges: jest.fn().mockResolvedValue([sampleChallenge]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArenaRecommendationService,
        { provide: PrismaService, useValue: prisma },
        { provide: ArenaChallengeRepository, useValue: challengeRepo },
      ],
    }).compile();

    service = module.get<ArenaRecommendationService>(ArenaRecommendationService);
  });

  it('recommends challenges targeting weak skills (<70%)', async () => {
    prisma.arenaSkillEvidence.findMany.mockResolvedValue([
      { taxonomyKey: 'nodejs_memory', scoreContribution: 45 },
      { taxonomyKey: 'nodejs_memory', scoreContribution: 50 },
    ]);

    const recommendations = await service.getRecommendedChallenges('user-1');
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.targetSkill).toBe('nodejs_memory');
    expect(recommendations[0]?.reason).toContain('nodejs_memory');
  });

  it('provides default progression recommendation when no weak skills exist', async () => {
    prisma.arenaSkillEvidence.findMany.mockResolvedValue([]);

    const recommendations = await service.getRecommendedChallenges('user-1');
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.targetSkill).toBe('general_engineering');
  });
});
