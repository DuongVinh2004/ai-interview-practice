import { Test, TestingModule } from '@nestjs/testing';
import { ReadinessService } from './services/readiness.service';
import { WeightProfileService } from './services/weight-profile.service';
import { TierClassificationService } from './services/tier-classification.service';
import { VelocityService } from './services/velocity.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { CompetencyArea } from '@ai-interview/contracts';

describe('Readiness Services (F009)', () => {
  let readinessService: ReadinessService;
  let weightProfileService: WeightProfileService;
  let tierService: TierClassificationService;
  let velocityService: VelocityService;

  const mockPrisma = {
    readinessWeightProfile: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    tierDefinition: {
      findMany: jest.fn(),
    },
    interviewTurn: {
      findMany: jest.fn(),
    },
    readinessSnapshot: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadinessService,
        WeightProfileService,
        TierClassificationService,
        VelocityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    readinessService = module.get<ReadinessService>(ReadinessService);
    weightProfileService = module.get<WeightProfileService>(WeightProfileService);
    tierService = module.get<TierClassificationService>(TierClassificationService);
    velocityService = module.get<VelocityService>(VelocityService);
    jest.clearAllMocks();
  });

  describe('Composite Readiness Formula', () => {
    it('computes weighted readiness and strictly caps at 100%', () => {
      const weights: Record<CompetencyArea, number> = {
        [CompetencyArea.SYSTEM_DESIGN]: 0.3,
        [CompetencyArea.DATABASE_CONCURRENCY]: 0.25,
        [CompetencyArea.LANGUAGE_CORE]: 0.2,
        [CompetencyArea.ARCHITECTURE_PATTERNS]: 0.15,
        [CompetencyArea.RESILIENCE_SECURITY]: 0.1,
      };

      const targets: Record<CompetencyArea, number> = {
        [CompetencyArea.SYSTEM_DESIGN]: 8.0,
        [CompetencyArea.DATABASE_CONCURRENCY]: 8.0,
        [CompetencyArea.LANGUAGE_CORE]: 8.0,
        [CompetencyArea.ARCHITECTURE_PATTERNS]: 8.0,
        [CompetencyArea.RESILIENCE_SECURITY]: 8.0,
      };

      // Case 1: Candidate exceeds all target scores (e.g. 10.0 / 8.0 -> min(1.25, 1.0) = 1.0)
      const perfectScores: Record<CompetencyArea, number> = {
        [CompetencyArea.SYSTEM_DESIGN]: 10.0,
        [CompetencyArea.DATABASE_CONCURRENCY]: 10.0,
        [CompetencyArea.LANGUAGE_CORE]: 9.5,
        [CompetencyArea.ARCHITECTURE_PATTERNS]: 9.0,
        [CompetencyArea.RESILIENCE_SECURITY]: 8.5,
      };

      const perfectReadiness = readinessService.computeCompositeReadiness(
        perfectScores,
        weights,
        targets,
      );
      expect(perfectReadiness).toBe(100.0);

      // Case 2: Candidate with 4.0 out of 8.0 everywhere (50% fulfillment)
      const halfScores: Record<CompetencyArea, number> = {
        [CompetencyArea.SYSTEM_DESIGN]: 4.0,
        [CompetencyArea.DATABASE_CONCURRENCY]: 4.0,
        [CompetencyArea.LANGUAGE_CORE]: 4.0,
        [CompetencyArea.ARCHITECTURE_PATTERNS]: 4.0,
        [CompetencyArea.RESILIENCE_SECURITY]: 4.0,
      };

      const halfReadiness = readinessService.computeCompositeReadiness(
        halfScores,
        weights,
        targets,
      );
      expect(halfReadiness).toBe(50.0);
    });
  });

  describe('95% Confidence Interval Calculation', () => {
    it('widens confidence interval when evidence count is low and narrows as evidence increases', () => {
      const score = 80.0;

      // Low evidence (n = 1)
      const lowEvidenceCI = readinessService.computeConfidenceInterval(score, 1);
      const lowMargin = lowEvidenceCI.high - score;

      // High evidence (n = 25)
      const highEvidenceCI = readinessService.computeConfidenceInterval(score, 25);
      const highMargin = highEvidenceCI.high - score;

      expect(lowMargin).toBeGreaterThan(highMargin);
      expect(lowEvidenceCI.low).toBeLessThanOrEqual(score);
      expect(lowEvidenceCI.high).toBeGreaterThanOrEqual(score);
      expect(highEvidenceCI.confidenceLevel).toBe('95%');
    });
  });

  describe('Tier Classification Service', () => {
    it('accurately classifies candidate into tiers based on exact score boundaries', () => {
      expect(tierService.classifyTier(92.0).slug).toBe('tier-3'); // Big Tech Ready
      expect(tierService.classifyTier(85.0).slug).toBe('tier-3'); // Boundary
      expect(tierService.classifyTier(75.0).slug).toBe('tier-2'); // Competitive Offer Ready
      expect(tierService.classifyTier(70.0).slug).toBe('tier-2'); // Boundary
      expect(tierService.classifyTier(62.0).slug).toBe('tier-1'); // Emerging Candidate
      expect(tierService.classifyTier(42.0).slug).toBe('tier-0'); // Needs Practice
    });
  });

  describe('Velocity & Time-to-Target Forecast', () => {
    it('calculates velocity and time to target weeks projection', () => {
      const forecast = velocityService.calculateVelocity(75.0, 71.0, 4); // +4 pts in 4 weeks -> 1.0 pt/week
      expect(forecast.status).toBe('IMPROVING');
      expect(forecast.weeklyRate).toBe(1.0);
      expect(forecast.weeksToNextTier).toBeDefined();

      const weeksToTarget = velocityService.calculateWeeksToTarget(6.0, 8.0, 0.5); // (8 - 6)/0.5 = 4 weeks
      expect(weeksToTarget).toBe(4);

      const zeroVelocity = velocityService.calculateWeeksToTarget(6.0, 8.0, 0.0);
      expect(zeroVelocity).toBeNull();
    });
  });

  describe('Full Dashboard Aggregation', () => {
    it('generates complete dashboard response with milestones, roadmap and Vietnamese disclaimer', async () => {
      mockPrisma.interviewTurn.findMany.mockResolvedValue([]);
      mockPrisma.readinessWeightProfile.findMany.mockResolvedValue([]);

      const dashboard = await readinessService.getReadinessDashboard('user-123', 'backend');
      expect(dashboard.userId).toBe('user-123');
      expect(dashboard.readinessScore).toBeGreaterThan(0);
      expect(dashboard.confidenceInterval).toBeDefined();
      expect(dashboard.breakdown.length).toBe(5);
      expect(dashboard.milestones.length).toBe(5);
      expect(dashboard.disclaimer).toContain('Chỉ số dựa trên kết quả luyện tập');
    });
  });
});
