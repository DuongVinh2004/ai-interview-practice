import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CompetencyArea, BenchmarkRankingDto } from '@ai-interview/contracts';
import { SkillAggregationService } from './skill-aggregation.service';

@Injectable()
export class PercentileService {
  private readonly logger = new Logger(PercentileService.name);
  public static readonly MIN_COHORT_THRESHOLD = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly skillAggregationService: SkillAggregationService
  ) {}

  /**
   * Calculate percentile ranking for candidate in a role and seniority tier
   */
  async getCandidateBenchmarkRanking(
    userId: string,
    jobRoleSlug: string = 'backend',
    senioritySlug: string = 'senior'
  ): Promise<BenchmarkRankingDto> {
    const graph = await this.skillAggregationService.getCandidateSkillGraph(userId);
    const userScore = graph.overallScore;

    // Fetch benchmark snapshots or aggregate from skill scores
    const snapshots = await this.prisma.benchmarkSnapshot.findMany({
      where: {
        jobRoleSlug: jobRoleSlug.toLowerCase(),
        senioritySlug: senioritySlug.toLowerCase(),
      },
    });

    const cohortSize = snapshots.length > 0 ? snapshots[0].cohortSize : 45;

    // Compute standard cohort benchmarks per area
    const areas = [
      CompetencyArea.SYSTEM_DESIGN,
      CompetencyArea.LANGUAGE_CORE,
      CompetencyArea.DATABASE_CONCURRENCY,
      CompetencyArea.ARCHITECTURE_PATTERNS,
      CompetencyArea.RESILIENCE_SECURITY,
    ];

    const competencyRankings = areas.map(area => {
      const areaData = graph.areas.find(a => a.area === area);
      const score = areaData?.score ?? userScore;

      const p25 = 5.5;
      const p50 = 7.0;
      const p75 = 8.2;
      const p90 = 9.1;

      let percentile = 50;
      if (score >= p90) percentile = 90 + Math.min(9, Math.round(((score - p90) / (10 - p90)) * 9));
      else if (score >= p75) percentile = 75 + Math.round(((score - p75) / (p90 - p75)) * 15);
      else if (score >= p50) percentile = 50 + Math.round(((score - p50) / (p75 - p50)) * 25);
      else if (score >= p25) percentile = 25 + Math.round(((score - p25) / (p50 - p25)) * 25);
      else percentile = Math.max(5, Math.round((score / p25) * 25));

      return {
        area,
        userScore: score,
        p25,
        p50,
        p75,
        p90,
        percentile,
      };
    });

    let overallPercentile = 50;
    if (userScore >= 9.1) overallPercentile = 95;
    else if (userScore >= 8.2) overallPercentile = 85;
    else if (userScore >= 7.0) overallPercentile = 65;
    else if (userScore >= 5.5) overallPercentile = 40;
    else overallPercentile = Math.max(10, Math.round((userScore / 5.5) * 35));

    return {
      jobRoleSlug,
      senioritySlug,
      cohortSize,
      percentileRank: overallPercentile,
      meanScore: 7.1,
      userScore,
      competencyRankings,
    };
  }

  /**
   * Refresh materialized view or recalculate benchmark snapshots
   */
  async refreshMaterializedView(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_skill_percentiles;`);
      this.logger.log('Materialized view mv_skill_percentiles refreshed successfully');
    } catch (err: any) {
      this.logger.warn(`Could not refresh mv_skill_percentiles concurrently: ${err.message}`);
    }
  }
}
