import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({ summary: 'Prometheus metrics scrape endpoint' })
  @ApiResponse({ status: 200, description: 'Prometheus formatted metrics text' })
  async getMetrics(@Res() res: Response): Promise<void> {
    const contentType = await this.metricsService.getMetricsContentType();
    const metrics = await this.metricsService.getMetrics();
    res.setHeader('Content-Type', contentType);
    res.send(metrics);
  }
}
