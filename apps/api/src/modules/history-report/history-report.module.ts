import { Module } from '@nestjs/common';
import { HistoryReportService } from './history-report.service';
import { HistoryReportController } from './history-report.controller';

@Module({
  controllers: [HistoryReportController],
  providers: [HistoryReportService],
  exports: [HistoryReportService],
})
export class HistoryReportModule {}
