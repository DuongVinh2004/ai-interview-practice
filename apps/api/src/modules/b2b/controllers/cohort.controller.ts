import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantRoleGuard, RequireTenantRoles } from '../guards/tenant-role.guard';
import { CohortService } from '../services/cohort.service';
import { CreateCohortDto, ImportRosterDto } from '../dto/b2b.dto';
import { TenantRole } from '@ai-interview/contracts';
import { RequestWithTenant } from '../middleware/tenant-context.middleware';

@ApiTags('B2B Cohorts & Rosters (F011)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRoleGuard)
@Controller('b2b/cohorts')
export class CohortController {
  constructor(private readonly cohortService: CohortService) {}

  @Get()
  @RequireTenantRoles(TenantRole.TENANT_ADMIN, TenantRole.INSTRUCTOR)
  @ApiOperation({ summary: 'List all cohorts in the organization' })
  async listCohorts(@Req() req: RequestWithTenant) {
    return this.cohortService.listCohorts(req.tenantId!);
  }

  @Post()
  @RequireTenantRoles(TenantRole.TENANT_ADMIN, TenantRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Create a new training cohort' })
  async createCohort(
    @Req() req: RequestWithTenant,
    @Body() dto: CreateCohortDto,
  ) {
    return this.cohortService.createCohort(req.tenantId!, dto.name, dto.description);
  }

  @Get(':id')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN, TenantRole.INSTRUCTOR, TenantRole.STUDENT)
  @ApiOperation({ summary: 'Get cohort detail with student roster' })
  async getCohort(
    @Req() req: RequestWithTenant,
    @Param('id') cohortId: string,
  ) {
    return this.cohortService.getCohort(cohortId, req.tenantId!);
  }

  @Post(':id/members/csv')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN, TenantRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Bulk import student roster via CSV' })
  async importRoster(
    @Req() req: RequestWithTenant,
    @Param('id') cohortId: string,
    @Body() dto: ImportRosterDto,
  ) {
    return this.cohortService.importRosterCsv(cohortId, req.tenantId!, dto.csvContent);
  }
}
