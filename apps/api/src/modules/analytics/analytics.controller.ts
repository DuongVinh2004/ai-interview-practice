import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Candidate Analytics & Competencies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('competency-radar')
  @ApiOperation({ summary: 'Get candidate multi-dimensional competency radar distribution' })
  async getCompetencyRadar(@CurrentUser('sub') userId: string) {
    return this.analyticsService.getCompetencyRadar(userId);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Get candidate longitudinal interview score progression' })
  async getProgressHistory(@CurrentUser('sub') userId: string) {
    return this.analyticsService.getProgressHistory(userId);
  }
}
