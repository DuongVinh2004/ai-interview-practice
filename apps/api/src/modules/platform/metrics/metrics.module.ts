import { Module, Global } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsExporterService } from './metrics-exporter.service';

@Global()
@Module({
  providers: [MetricsService, MetricsExporterService],
  exports: [MetricsService],
})
export class MetricsModule {}
