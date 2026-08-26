import { Test, TestingModule } from '@nestjs/testing';
import { SkillAggregationService } from './services/skill-aggregation.service';
import { PercentileService } from './services/percentile.service';
import { GapAnalysisService } from './services/gap-analysis.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { CompetencyArea } from '@ai-interview/contracts';

describe('SkillGraph Services (F008)', () => {
  let aggregationService: SkillAggregationService;
  let percentileService: PercentileService;
  let gapService: GapAnalysisService;

  const mockPrisma = {
    skillNode: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    skillScore: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    interviewTurn: {
      findMany: jest.fn(),
    },
    benchmarkSnapshot: {
      findMany: jest.fn(),
    },
    $executeRawUnsafe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillAggregationService,
        PercentileService,
        GapAnalysisService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    aggregationService = module.get<SkillAggregationService>(SkillAggregationService);
    percentileService = module.get<PercentileService>(PercentileService);
    gapService = module.get<GapAnalysisService>(GapAnalysisService);
    jest.clearAllMocks();
  });

  describe('Exponential Decay Scoring Algorithm', () => {
    it('calculates decay weighted score accurately for known Delta t values', () => {
      const now = new Date('2026-08-24T12:00:00Z');
      // Evidence 1: score 10.0 from today (delta_t = 0 days -> weight = exp(0) = 1.0)
      // Evidence 2: score 6.0 from 100 days ago (delta_t = 100 days -> weight = exp(-0.01*100) = exp(-1) ≈ 0.367879)
      const evidences = [
        { score: 10.0, evaluatedAt: new Date('2026-08-24T12:00:00Z') },
        { score: 6.0, evaluatedAt: new Date('2026-05-16T12:00:00Z') },
      ];

      const weightedScore = aggregationService.calculateExponentialDecayScore(evidences, 0.01, now);
      // Expected = (10.0 * 1.0 + 6.0 * 0.367879) / (1.0 + 0.367879) = (10 + 2.207274) / 1.367879 ≈ 8.92
      expect(weightedScore).toBeCloseTo(8.92, 1);
      expect(weightedScore).toBeGreaterThan(6.0);
      expect(weightedScore).toBeLessThan(10.0);
    });

    it('returns 0.0 when evidence list is empty', () => {
      expect(aggregationService.calculateExponentialDecayScore([])).toBe(0.0);
    });

    it('clamps scores strictly between 0.0 and 10.0', () => {
      const evidences = [{ score: 12.0, evaluatedAt: new Date() }];
      const result = aggregationService.calculateExponentialDecayScore(evidences);
      expect(result).toBe(10.0);
    });
  });

  describe('Candidate Skill Graph Generation', () => {
    it('constructs 3-tier skill graph hierarchy with areas, sub-competencies, and topics', async () => {
      const userId = 'user-123';
      mockPrisma.skillNode.findMany.mockResolvedValue([
        {
          id: 'area-1',
          name: 'System Design & Scalability',
          nameVi: 'Thiết kế Hệ thống',
          slug: 'system-design',
          level: 1,
          competencyArea: CompetencyArea.SYSTEM_DESIGN,
          order: 0,
        },
        {
          id: 'sub-1',
          parentId: 'area-1',
          name: 'System Design Fundamentals',
          nameVi: 'Kiến thức Nền tảng',
          slug: 'system-design-fundamentals',
          level: 2,
          competencyArea: CompetencyArea.SYSTEM_DESIGN,
          order: 0,
        },
      ]);

      mockPrisma.skillScore.findMany.mockResolvedValue([
        {
          id: 'score-1',
          userId,
          skillNodeId: 'sub-1',
          rawScore: 8.5,
          weightedScore: 8.5,
          evidenceCount: 4,
          rubricVersion: 'v1.0',
          lastEvaluatedAt: new Date(),
        },
      ]);

      mockPrisma.interviewTurn.findMany.mockResolvedValue([]);

      const result = await aggregationService.getCandidateSkillGraph(userId);
      expect(result.userId).toBe(userId);
      expect(result.overallScore).toBe(8.5);
      expect(result.areas).toHaveLength(1);
      expect(result.areas[0].area).toBe(CompetencyArea.SYSTEM_DESIGN);
      expect(result.areas[0].subCompetencies).toHaveLength(1);
      expect(result.areas[0].subCompetencies[0].score).toBe(8.5);
    });
  });

  describe('Percentile Benchmark Ranking', () => {
    it('calculates percentile ranking with standard benchmark thresholds', async () => {
      const userId = 'user-123';
      jest.spyOn(aggregationService, 'getCandidateSkillGraph').mockResolvedValue({
        userId,
        overallScore: 8.5,
        areas: [
          {
            area: CompetencyArea.SYSTEM_DESIGN,
            name: 'System Design',
            score: 8.8,
            benchmarkP50: 7.0,
            percentile: 85,
            subCompetencies: [],
          },
        ],
        lastUpdated: new Date().toISOString(),
      });

      mockPrisma.benchmarkSnapshot.findMany.mockResolvedValue([
        {
          cohortSize: 60,
          p25: 5.5,
          p50: 7.0,
          p75: 8.2,
          p90: 9.1,
          mean: 7.1,
          stdDev: 1.2,
        },
      ]);

      const ranking = await percentileService.getCandidateBenchmarkRanking(
        userId,
        'backend',
        'senior',
      );
      expect(ranking.cohortSize).toBe(60);
      expect(ranking.userScore).toBe(8.5);
      expect(ranking.percentileRank).toBeGreaterThan(75);
      expect(ranking.competencyRankings.length).toBe(5);
    });
  });

  describe('Gap Analysis Service', () => {
    it('identifies top gaps and generates prioritized remediation actions', async () => {
      const userId = 'user-123';
      jest.spyOn(aggregationService, 'getCandidateSkillGraph').mockResolvedValue({
        userId,
        overallScore: 6.5,
        areas: [
          {
            area: CompetencyArea.DATABASE_CONCURRENCY,
            name: 'Database & Concurrency',
            score: 5.0,
            benchmarkP50: 7.0,
            subCompetencies: [
              {
                id: 'sub-db-1',
                name: 'Lock Contention & Deadlocks',
                slug: 'lock-contention',
                level: 2,
                competencyArea: CompetencyArea.DATABASE_CONCURRENCY,
                score: 4.5,
                rawScore: 4.5,
                evidenceCount: 2,
              },
            ],
          },
        ],
        lastUpdated: new Date().toISOString(),
      });

      const analysis = await gapService.analyzeGaps(userId, 'Senior Backend Engineer', 'Senior');
      expect(analysis.roleTitle).toBe('Senior Backend Engineer');
      expect(analysis.topGaps).toHaveLength(1);
      expect(analysis.topGaps[0].priority).toBe('HIGH');
      expect(analysis.topGaps[0].gapScore).toBe(3.5); // Target 8.0 - 4.5
      expect(analysis.topGaps[0].suggestedAction).toContain('Focused Remediation');
    });
  });
});
