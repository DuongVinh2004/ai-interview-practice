import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { HistoryReportService } from './history-report.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole, SessionState, SessionMode } from '@ai-interview/contracts';

@ApiTags('History & Results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interviews')
export class HistoryReportController {
  constructor(private readonly historyReportService: HistoryReportService) {}

  @Get('history')
  @ApiOperation({ summary: 'Get paginated candidate interview history with search and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'state', required: false, enum: SessionState })
  @ApiQuery({ name: 'jobRoleId', required: false, type: String })
  @ApiQuery({ name: 'sessionMode', required: false, enum: SessionMode })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'minScore', required: false, type: Number })
  @ApiQuery({ name: 'maxScore', required: false, type: Number })
  async getHistory(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('state') state?: SessionState,
    @Query('jobRoleId') jobRoleId?: string,
    @Query('sessionMode') sessionMode?: SessionMode,
    @Query('search') search?: string,
    @Query('minScore') minScore?: number,
    @Query('maxScore') maxScore?: number,
  ) {
    return this.historyReportService.getHistory(userId, {
      page,
      limit,
      state,
      jobRoleId,
      sessionMode,
      search,
      minScore,
      maxScore,
    });
  }

  @Get(':id/result')
  @ApiOperation({ summary: 'Get full result breakdown and rubrics for a completed interview' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async getSessionResult(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') sessionId: string,
  ) {
    return this.historyReportService.getSessionResult(userId, userRole, sessionId);
  }
}
