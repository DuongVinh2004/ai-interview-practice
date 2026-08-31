import { Module } from '@nestjs/common';
import { SkillGraphController } from './skill-graph.controller';
import { SkillAggregationService } from './services/skill-aggregation.service';
import { PercentileService } from './services/percentile.service';
import { GapAnalysisService } from './services/gap-analysis.service';
import { BatchAggregationProcessor } from './services/batch-aggregation.processor';
import { isWorkerProcess } from '../platform/process-role';

@Module({
  controllers: [SkillGraphController],
  providers: [
    SkillAggregationService,
    PercentileService,
    GapAnalysisService,
    ...(isWorkerProcess() ? [BatchAggregationProcessor] : []),
  ],
  exports: [SkillAggregationService, PercentileService, GapAnalysisService],
})
export class SkillGraphModule {}
