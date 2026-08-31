import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { CompetencyArea, SessionState } from '@ai-interview/contracts';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;

  const mockUserId = 'user-123';

  beforeEach(async () => {
    prisma = {
      interviewSession: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should return baseline radar when user has no completed sessions', async () => {
    prisma.interviewSession.findMany.mockResolvedValue([]);

    const result = await service.getCompetencyRadar(mockUserId);
    expect(result.totalEvaluatedTurns).toBe(0);
    expect(result.competencies).toHaveLength(5);
    expect(result.overallAverageScore).toBe(0);
  });

  it('should compute competency radar scores from evaluated turns', async () => {
    prisma.interviewSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        state: SessionState.COMPLETED,
        technologies: [{ technology: { name: 'PostgreSQL' } }],
        turns: [
          {
            turnNumber: 1,
            question: {
              keyFocus: 'ACID Transactions and Indexing',
              content: 'Explain B-Tree index scan.',
            },
            answer: {
              evaluation: {
                score: 9.0,
                authorityState: 'AUTHORITATIVE',
                needsReview: false,
                provider: 'openai',
                evidence: ['Index explanation'],
              },
            },
          },
          {
            turnNumber: 2,
            question: {
              keyFocus: 'Circuit Breaker Pattern',
              content: 'How does resilience circuit breaker work?',
            },
            answer: {
              evaluation: {
                score: 8.0,
                authorityState: 'AUTHORITATIVE',
                needsReview: false,
                provider: 'gemini',
                evidence: ['Circuit breaker explanation'],
              },
            },
          },
        ],
      },
    ]);

    const result = await service.getCompetencyRadar(mockUserId);
    expect(result.totalEvaluatedTurns).toBe(2);
    expect(result.overallAverageScore).toBe(8.5);

    const dbComp = (result.competencies as any[]).find(
      (c: any) => c.competency === CompetencyArea.DATABASE_CONCURRENCY,
    );
    expect(dbComp?.score).toBe(9.0);
    expect(dbComp?.benchmarkLevel).toBe('Senior / Staff');

    const resComp = (result.competencies as any[]).find(
      (c: any) => c.competency === CompetencyArea.RESILIENCE_SECURITY,
    );
    expect(resComp?.score).toBe(8.0);
  });

  it('excludes missing-provenance and needs-review evaluations from competency scores', async () => {
    prisma.interviewSession.findMany.mockResolvedValue([
      {
        id: 'session-review-only',
        state: SessionState.COMPLETED,
        technologies: [],
        turns: [
          {
            question: { keyFocus: 'Security', content: 'Explain authentication.' },
            answer: {
              evaluation: {
                score: 9.9,
                authorityState: 'NEEDS_REVIEW',
                needsReview: true,
                provider: 'mock',
                evidence: [],
              },
            },
          },
          {
            question: { keyFocus: 'Database', content: 'Explain indexing.' },
            answer: { evaluation: { score: 9.8 } },
          },
        ],
      },
    ]);

    const result = await service.getCompetencyRadar(mockUserId);

    expect(result.totalEvaluatedTurns).toBe(0);
    expect(result.overallAverageScore).toBe(0);
  });

  it('should compute longitudinal progress and score velocity', async () => {
    prisma.interviewSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        state: SessionState.COMPLETED,
        overallScore: 6.0,
        targetDifficulty: 1,
        completedAt: new Date('2026-08-01'),
        createdAt: new Date('2026-08-01'),
        jobRole: { name: 'Frontend Engineer' },
        seniorityLevel: { name: 'Junior' },
        _count: { turns: 5 },
      },
      {
        id: 'session-2',
        state: SessionState.COMPLETED,
        overallScore: 8.5,
        targetDifficulty: 2,
        completedAt: new Date('2026-08-10'),
        createdAt: new Date('2026-08-10'),
        jobRole: { name: 'Full-Stack Engineer' },
        seniorityLevel: { name: 'Mid-Level' },
        _count: { turns: 5 },
      },
    ]);

    const result = await service.getProgressHistory(mockUserId);
    expect(result.totalCompletedSessions).toBe(2);
    expect(result.averageScore).toBe(7.3);
    expect(result.highestScore).toBe(8.5);
    expect(result.scoreVelocity).toBe(2.5); // 8.5 - 6.0 = 2.5 improvement
  });

  describe('Redis Caching & Invalidation (NEW-DATA-03)', () => {
    let mockRedisClient: any;
    let mockRedisService: any;
    let serviceWithRedis: AnalyticsService;

    beforeEach(async () => {
      mockRedisClient = {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
      };

      mockRedisService = {
        getClient: jest.fn(() => mockRedisClient),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AnalyticsService,
          { provide: PrismaService, useValue: prisma },
          { provide: 'RedisService', useValue: mockRedisService },
        ],
      })
        .useMocker(token => {
          if (token === 'RedisService' || token?.toString?.().includes('RedisService')) {
            return mockRedisService;
          }
          return undefined;
        })
        .compile();

      serviceWithRedis = new AnalyticsService(prisma, mockRedisService);
    });

    it('returns cached competency radar on cache hit', async () => {
      const cachedData = {
        userId: mockUserId,
        totalEvaluatedTurns: 10,
        overallAverageScore: 9.2,
        competencies: [],
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await serviceWithRedis.getCompetencyRadar(mockUserId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(`user:analytics:${mockUserId}:radar`);
      expect(result).toEqual(cachedData);
      expect(prisma.interviewSession.findMany).not.toHaveBeenCalled();
    });

    it('computes and stores in cache on cache miss for progress history', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      prisma.interviewSession.findMany.mockResolvedValue([]);

      const result = await serviceWithRedis.getProgressHistory(mockUserId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(`user:analytics:${mockUserId}:progress`);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `user:analytics:${mockUserId}:progress`,
        expect.any(String),
        'EX',
        3600,
      );
      expect(result.totalCompletedSessions).toBe(0);
    });

    it('invalidates user analytics cache on interview.completed event', async () => {
      await serviceWithRedis.handleInterviewCompleted({
        userId: mockUserId,
        sessionId: 'session-123',
      });

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `user:analytics:${mockUserId}:radar`,
        `user:analytics:${mockUserId}:progress`,
        `user:analytics:${mockUserId}`,
      );
    });
  });
});
