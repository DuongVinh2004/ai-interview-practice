import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { PercentileService } from './percentile.service';
import { SkillAggregationService } from './skill-aggregation.service';

export const SKILL_AGGREGATION_QUEUE = 'skill-aggregation';
export const SKILL_BATCH_JOB = 'nightly-aggregation';

@Processor(SKILL_AGGREGATION_QUEUE)
export class BatchAggregationProcessor extends WorkerHost {
  private readonly logger = new Logger(BatchAggregationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly percentileService: PercentileService,
    private readonly skillAggregationService: SkillAggregationService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Starting skill aggregation batch job: ${job.name} (Job ID: ${job.id})`);

    try {
      // 1. Fetch active users with evaluations
      const users = await this.prisma.user.findMany({
        where: {
          sessions: {
            some: {
              state: 'COMPLETED',
            },
          },
        },
        select: { id: true },
      });

      this.logger.log(`Aggregating skill decay scores for ${users.length} active candidates`);

      // 2. Compute updated scores for each user
      for (const u of users) {
        await this.skillAggregationService.getCandidateSkillGraph(u.id);
      }

      // 3. Refresh Materialized Views
      await this.percentileService.refreshMaterializedView();

      this.logger.log(`Completed nightly skill aggregation successfully`);
      return { success: true, processedUsers: users.length };
    } catch (err: any) {
      this.logger.error(`Error during batch aggregation: ${err.message}`, err.stack);
      throw err;
    }
  }
}
