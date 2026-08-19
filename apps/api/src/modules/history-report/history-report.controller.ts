import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { HistoryReportService } from './history-report.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole, SessionState } from '@ai-interview/contracts';

@ApiTags('History & Results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interviews')
export class HistoryReportController {
  constructor(private readonly historyReportService: HistoryReportService) {}

  @Get('history')
  @ApiOperation({ summary: 'Get paginated candidate interview history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'state', required: false, enum: SessionState })
  @ApiQuery({ name: 'jobRoleId', required: false, type: String })
  async getHistory(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('state') state?: SessionState,
    @Query('jobRoleId') jobRoleId?: string,
  ) {
    return this.historyReportService.getHistory(userId, { page, limit, state, jobRoleId });
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
