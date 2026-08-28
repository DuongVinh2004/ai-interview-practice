import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../platform/prisma/prisma.service';
import { RedisService } from '../platform/redis/redis.service';
import { CompetencyArea, SessionState } from '@ai-interview/contracts';

interface CompetencyMapping {
  area: CompetencyArea;
  name: string;
  description: string;
  keywords: string[];
}

const COMPETENCY_DEFINITIONS: CompetencyMapping[] = [
  {
    area: CompetencyArea.SYSTEM_DESIGN,
    name: 'System Design & Scalability',
    description: 'Distributed systems, load balancing, caching, queuing, and high availability.',
    keywords: [
      'system design',
      'scalability',
      'distributed',
      'cache',
      'queue',
      'kafka',
      'redis',
      'cdn',
      'microservice',
      'load balancer',
      'throughput',
      'latency',
    ],
  },
  {
    area: CompetencyArea.LANGUAGE_CORE,
    name: 'Core Language & Fundamentals',
    description:
      'Type systems, runtime internals, event loop, memory management, and asynchronous I/O.',
    keywords: [
      'typescript',
      'javascript',
      'event loop',
      'async',
      'promise',
      'memory',
      'closure',
      'prototype',
      'v8',
      'garbage collection',
      'concurrency model',
    ],
  },
  {
    area: CompetencyArea.DATABASE_CONCURRENCY,
    name: 'Databases & Concurrency',
    description:
      'Data modeling, ACID, indexing, query optimization, lock contention, and replication.',
    keywords: [
      'database',
      'sql',
      'postgresql',
      'transaction',
      'acid',
      'index',
      'lock',
      'isolation',
      'concurrency',
      'sharding',
      'prisma',
      'nosql',
      'query',
    ],
  },
  {
    area: CompetencyArea.ARCHITECTURE_PATTERNS,
    name: 'Software Architecture & Patterns',
    description:
      'Clean architecture, SOLID principles, domain-driven design, modularity, and APIs.',
    keywords: [
      'architecture',
      'solid',
      'design pattern',
      'clean architecture',
      'dependency injection',
      'rest',
      'graphql',
      'nestjs',
      'react',
      'modular',
      'coupling',
      'cohesion',
    ],
  },
  {
    area: CompetencyArea.RESILIENCE_SECURITY,
    name: 'Resilience & Security',
    description:
      'Circuit breakers, rate limiting, authentication, defensive coding, and error handling.',
    keywords: [
      'resilience',
      'security',
      'circuit breaker',
      'rate limit',
      'auth',
      'jwt',
      'owasp',
      'injection',
      'fallback',
      'timeout',
      'retry',
      'error handling',
    ],
  },
];

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  /**
   * Aggregates evaluated interview turns into a multi-dimensional Competency Radar
   */
  async getCompetencyRadar(userId: string) {
    const cacheKey = `user:analytics:${userId}:radar`;
    if (this.redisService) {
      try {
        const client = this.redisService.getClient();
        if (client) {
          const cached = await client.get(cacheKey);
          if (cached) {
            return JSON.parse(cached);
          }
        }
      } catch (err: any) {
        this.logger.warn(`Redis get cache error for ${cacheKey}: ${err.message}`);
      }
    }
    // 1. Fetch completed non-sandbox sessions with evaluated turns
    const sessions = await this.prisma.interviewSession.findMany({
      where: {
        userId,
        state: SessionState.COMPLETED,
        isSandbox: false,
      },
      include: {
        jobRole: true,
        seniorityLevel: true,
        technologies: { include: { technology: true } },
        turns: {
          include: {
            question: true,
            answer: {
              include: { evaluation: true },
            },
          },
        },
      },
    });

    const turnEvaluations: Array<{
      score: number;
      keyFocus: string;
      questionContent: string;
      techNames: string[];
    }> = [];

    for (const session of sessions) {
      const techNames = session.technologies.map(t => t.technology.name.toLowerCase());
      for (const turn of session.turns) {
        const evaluation = turn.answer?.evaluation;
        if (
          evaluation &&
          (!evaluation.authorityState || evaluation.authorityState === 'AUTHORITATIVE')
        ) {
          turnEvaluations.push({
            score: evaluation.score,
            keyFocus: turn.question?.keyFocus?.toLowerCase() || '',
            questionContent: turn.question?.content?.toLowerCase() || '',
            techNames,
          });
        }
      }
    }

    const totalEvaluatedTurns = turnEvaluations.length;

    // 2. Score buckets for each competency area
    const competencyBuckets: Record<CompetencyArea, { scores: number[]; count: number }> = {
      [CompetencyArea.SYSTEM_DESIGN]: { scores: [], count: 0 },
      [CompetencyArea.LANGUAGE_CORE]: { scores: [], count: 0 },
      [CompetencyArea.DATABASE_CONCURRENCY]: { scores: [], count: 0 },
      [CompetencyArea.ARCHITECTURE_PATTERNS]: { scores: [], count: 0 },
      [CompetencyArea.RESILIENCE_SECURITY]: { scores: [], count: 0 },
    };

    // If no evaluations exist, provide default baseline
    if (totalEvaluatedTurns === 0) {
      const defaultCompetencies = COMPETENCY_DEFINITIONS.map(def => ({
        competency: def.area,
        name: def.name,
        score: 0,
        sampleCount: 0,
        benchmarkLevel: 'Not Evaluated',
        description: def.description,
      }));

      return {
        userId,
        totalEvaluatedTurns: 0,
        overallAverageScore: 0,
        competencies: defaultCompetencies,
        topStrengths: [],
        growthAreas: [],
        updatedAt: new Date().toISOString(),
      };
    }

    // 3. Map each evaluation to matching competency areas
    for (const item of turnEvaluations) {
      const questionText = `${item.keyFocus} ${item.questionContent}`;
      let matchedAny = false;

      // First check question text & key focus
      for (const def of COMPETENCY_DEFINITIONS) {
        const matches = def.keywords.some(kw => questionText.includes(kw));
        if (matches) {
          competencyBuckets[def.area].scores.push(item.score);
          competencyBuckets[def.area].count += 1;
          matchedAny = true;
        }
      }

      // If no direct question match, check technology stack
      if (!matchedAny) {
        const techText = item.techNames.join(' ');
        for (const def of COMPETENCY_DEFINITIONS) {
          const matches = def.keywords.some(kw => techText.includes(kw));
          if (matches) {
            competencyBuckets[def.area].scores.push(item.score);
            competencyBuckets[def.area].count += 1;
            matchedAny = true;
          }
        }
      }

      // If still no explicit keyword matched, distribute to general architecture
      if (!matchedAny) {
        competencyBuckets[CompetencyArea.ARCHITECTURE_PATTERNS].scores.push(item.score);
        competencyBuckets[CompetencyArea.ARCHITECTURE_PATTERNS].count += 1;
      }
    }

    // Calculate total average score
    const allScores = turnEvaluations.map(t => t.score);
    const overallAverageScore = Number(
      (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1),
    );

    // 4. Calculate competency scores and benchmark tiers
    const competencies = COMPETENCY_DEFINITIONS.map(def => {
      const bucket = competencyBuckets[def.area];
      const avg =
        bucket.scores.length > 0
          ? Number((bucket.scores.reduce((a, b) => a + b, 0) / bucket.scores.length).toFixed(1))
          : overallAverageScore > 0
            ? overallAverageScore
            : 0;

      let benchmarkLevel = 'Junior';
      if (avg >= 8.5) benchmarkLevel = 'Senior / Staff';
      else if (avg >= 7.0) benchmarkLevel = 'Mid-Level';
      else if (avg >= 5.0) benchmarkLevel = 'Junior';
      else benchmarkLevel = 'Foundational';

      return {
        competency: def.area,
        name: def.name,
        score: avg,
        sampleCount: bucket.count,
        benchmarkLevel,
        description: def.description,
      };
    });

    // 5. Rank top strengths and growth areas
    const sorted = [...competencies].sort((a, b) => b.score - a.score);
    const topStrengths = sorted.slice(0, 2).map(c => c.name);
    const growthAreas = sorted
      .slice(-2)
      .reverse()
      .map(c => c.name);

    const result = {
      userId,
      totalEvaluatedTurns,
      overallAverageScore,
      competencies,
      topStrengths,
      growthAreas,
      updatedAt: new Date().toISOString(),
    };

    if (this.redisService) {
      try {
        const client = this.redisService.getClient();
        if (client) {
          await client.set(cacheKey, JSON.stringify(result), 'EX', 3600);
        }
      } catch (err: any) {
        this.logger.warn(`Redis set cache error for ${cacheKey}: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Computes longitudinal progression trends across completed interview sessions
   */
  async getProgressHistory(userId: string) {
    const cacheKey = `user:analytics:${userId}:progress`;
    if (this.redisService) {
      try {
        const client = this.redisService.getClient();
        if (client) {
          const cached = await client.get(cacheKey);
          if (cached) {
            return JSON.parse(cached);
          }
        }
      } catch (err: any) {
        this.logger.warn(`Redis get cache error for ${cacheKey}: ${err.message}`);
      }
    }

    const sessions = await this.prisma.interviewSession.findMany({
      where: {
        userId,
        state: SessionState.COMPLETED,
        isSandbox: false,
        overallScore: { not: null },
      },
      orderBy: { completedAt: 'asc' },
      include: {
        jobRole: true,
        seniorityLevel: true,
        _count: { select: { turns: true } },
      },
    });

    if (sessions.length === 0) {
      const emptyResult = {
        userId,
        totalCompletedSessions: 0,
        averageScore: 0,
        highestScore: 0,
        scoreVelocity: 0,
        sessions: [],
      };

      if (this.redisService) {
        try {
          const client = this.redisService.getClient();
          if (client) {
            await client.set(cacheKey, JSON.stringify(emptyResult), 'EX', 3600);
          }
        } catch (err: any) {
          this.logger.warn(`Redis set cache error for ${cacheKey}: ${err.message}`);
        }
      }

      return emptyResult;
    }

    const sessionPoints = sessions.map(s => ({
      sessionId: s.id,
      completedAt: (s.completedAt || s.createdAt).toISOString(),
      jobRoleName: s.jobRole.name,
      seniorityLevelName: s.seniorityLevel.name,
      overallScore: s.overallScore || 0,
      targetDifficulty: s.targetDifficulty,
      turnsCount: s._count.turns,
    }));

    const scores = sessionPoints.map(s => s.overallScore);
    const averageScore = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));
    const highestScore = Math.max(...scores);

    // Calculate score velocity (difference between latest 3 and earliest 3 sessions)
    let scoreVelocity = 0;
    if (scores.length >= 2) {
      const recentCount = Math.min(3, Math.floor(scores.length / 2));
      const earliestAvg = scores.slice(0, recentCount).reduce((a, b) => a + b, 0) / recentCount;
      const latestAvg = scores.slice(-recentCount).reduce((a, b) => a + b, 0) / recentCount;
      scoreVelocity = Number((latestAvg - earliestAvg).toFixed(1));
    }

    const result = {
      userId,
      totalCompletedSessions: sessions.length,
      averageScore,
      highestScore,
      scoreVelocity,
      sessions: sessionPoints,
    };

    if (this.redisService) {
      try {
        const client = this.redisService.getClient();
        if (client) {
          await client.set(cacheKey, JSON.stringify(result), 'EX', 3600);
        }
      } catch (err: any) {
        this.logger.warn(`Redis set cache error for ${cacheKey}: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Invalidates cached analytics data for a specific user (NEW-DATA-03)
   */
  async invalidateUserAnalyticsCache(userId: string): Promise<void> {
    if (!userId || !this.redisService) return;
    try {
      const client = this.redisService.getClient();
      if (client) {
        await client.del(
          `user:analytics:${userId}:radar`,
          `user:analytics:${userId}:progress`,
          `user:analytics:${userId}`,
        );
        this.logger.log(`[NEW-DATA-03] Invalidated analytics cache for user: ${userId}`);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to invalidate analytics cache for user ${userId}: ${err.message}`);
    }
  }

  @OnEvent('interview.completed')
  async handleInterviewCompleted(payload: { userId: string; sessionId?: string }) {
    if (payload?.userId) {
      this.logger.log(
        `Handling interview.completed event for analytics cache invalidation (user ${payload.userId})`,
      );
      await this.invalidateUserAnalyticsCache(payload.userId);
    }
  }
}
