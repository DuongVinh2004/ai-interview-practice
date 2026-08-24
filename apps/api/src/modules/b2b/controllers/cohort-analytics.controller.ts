import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantRoleGuard, RequireTenantRoles } from '../guards/tenant-role.guard';
import { CohortAnalyticsService } from '../services/cohort-analytics.service';
import { TenantRole } from '@ai-interview/contracts';
import { RequestWithTenant } from '../middleware/tenant-context.middleware';

@ApiTags('B2B Cohort Analytics (F011)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRoleGuard)
@Controller('b2b/analytics')
export class CohortAnalyticsController {
  constructor(private readonly cohortAnalyticsService: CohortAnalyticsService) {}

  @Get('cohort/:id')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN, TenantRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Get aggregated cohort analytics, score distribution, and student progress' })
  async getCohortAnalytics(
    @Req() req: RequestWithTenant,
    @Param('id') cohortId: string,
  ) {
    return this.cohortAnalyticsService.getCohortAnalytics(cohortId, req.tenantId!);
  }

  @Get('heatmap/:id')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN, TenantRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Get competency heatmap for cohort' })
  async getCohortHeatmap(
    @Req() req: RequestWithTenant,
    @Param('id') cohortId: string,
  ) {
    const analytics = await this.cohortAnalyticsService.getCohortAnalytics(cohortId, req.tenantId!);
    return {
      cohortId: analytics.cohortId,
      cohortName: analytics.cohortName,
      skillHeatmap: analytics.skillHeatmap,
    };
  }
}
