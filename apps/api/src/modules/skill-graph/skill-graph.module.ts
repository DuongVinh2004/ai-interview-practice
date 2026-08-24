import { Module } from '@nestjs/common';
import { SkillGraphController } from './skill-graph.controller';
import { SkillAggregationService } from './services/skill-aggregation.service';
import { PercentileService } from './services/percentile.service';
import { GapAnalysisService } from './services/gap-analysis.service';
import { BatchAggregationProcessor } from './services/batch-aggregation.processor';

@Module({
  controllers: [SkillGraphController],
  providers: [
    SkillAggregationService,
    PercentileService,
    GapAnalysisService,
    BatchAggregationProcessor,
  ],
  exports: [SkillAggregationService, PercentileService, GapAnalysisService],
})
export class SkillGraphModule {}
