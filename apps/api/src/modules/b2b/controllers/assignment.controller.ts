import { Controller, Post, Get, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantRoleGuard, RequireTenantRoles } from '../guards/tenant-role.guard';
import { AssignmentService } from '../services/assignment.service';
import { CreateAssignmentDto, PublishAssignmentDto } from '../dto/b2b.dto';
import { TenantRole } from '@ai-interview/contracts';
import { RequestWithTenant } from '../middleware/tenant-context.middleware';

@ApiTags('B2B Assignments (F011)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRoleGuard)
@Controller('b2b')
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post('assignments')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN, TenantRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Create a new interview assignment test for a cohort' })
  async createAssignment(@Req() req: RequestWithTenant, @Body() dto: CreateAssignmentDto) {
    return this.assignmentService.createAssignment(dto.cohortId, req.tenantId!, dto);
  }

  @Put('assignments/:id/publish')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN, TenantRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Publish or close an assignment' })
  async publishAssignment(
    @Req() req: RequestWithTenant,
    @Param('id') assignmentId: string,
    @Body() dto: PublishAssignmentDto,
  ) {
    return this.assignmentService.publishAssignment(assignmentId, req.tenantId!, dto.status);
  }

  @Get('cohorts/:id/assignments')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN, TenantRole.INSTRUCTOR, TenantRole.STUDENT)
  @ApiOperation({ summary: 'List all assignments for a specific cohort' })
  async listAssignments(@Req() req: RequestWithTenant, @Param('id') cohortId: string) {
    return this.assignmentService.listCohortAssignments(cohortId, req.tenantId!);
  }
}
