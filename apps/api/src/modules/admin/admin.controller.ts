import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { EvalHarnessService } from './eval-harness.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MfaStepUpGuard } from '../auth/guards/mfa-step-up.guard';
import { UserRole, UserStatus, AiRunStatus } from '@ai-interview/contracts';
import { LockUserRequestDto } from './dto/admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, MfaStepUpGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly evalHarnessService: EvalHarnessService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Search and list all users (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'status', required: false, enum: UserStatus })
  async listUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
  ) {
    return this.adminService.listUsers({ page, limit, search, role, status });
  }

  @Post('users/:id/lock')
  @UseGuards(MfaStepUpGuard)
  @ApiOperation({ summary: 'Soft-lock a user account (Admin with Step-Up only)' })
  @ApiParam({ name: 'id', description: 'User ID to lock' })
  async lockUser(
    @CurrentUser('sub') adminId: string,
    @Param('id') targetUserId: string,
    @Body() dto: LockUserRequestDto,
  ) {
    return this.adminService.lockUser(adminId, targetUserId, dto.reason);
  }

  @Post('users/:id/unlock')
  @UseGuards(MfaStepUpGuard)
  @ApiOperation({ summary: 'Unlock a soft-locked user account (Admin with Step-Up only)' })
  @ApiParam({ name: 'id', description: 'User ID to unlock' })
  async unlockUser(@CurrentUser('sub') adminId: string, @Param('id') targetUserId: string) {
    return this.adminService.unlockUser(adminId, targetUserId);
  }

  @Get('ai/runs')
  @ApiOperation({ summary: 'List and filter AI execution audit runs (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'provider', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: AiRunStatus })
  @ApiQuery({ name: 'sessionId', required: false, type: String })
  async listAiRuns(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('provider') provider?: string,
    @Query('status') status?: AiRunStatus,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.adminService.listAiRuns({ page, limit, provider, status, sessionId });
  }

  @Get('ai/metrics')
  @ApiOperation({
    summary: 'Get AI telemetry aggregated metrics & circuit breaker states (Admin only)',
  })
  async getAiMetrics() {
    return this.adminService.getAiMetrics();
  }

  @Get('ai/prompts')
  @ApiOperation({ summary: 'List all versioned prompt templates (Admin only)' })
  async listPromptVersions() {
    return this.adminService.listPromptVersions();
  }

  @Post('ai/prompts/:id/activate')
  @UseGuards(MfaStepUpGuard)
  @ApiOperation({ summary: 'Activate a specific prompt version (Admin with Step-Up only)' })
  @ApiParam({ name: 'id', description: 'Prompt version ID' })
  async activatePromptVersion(@CurrentUser('sub') adminId: string, @Param('id') versionId: string) {
    return this.adminService.activatePromptVersion(adminId, versionId);
  }

  // --- AI Evaluation Regression Harness Endpoints (Epic 9) ---

  @Post('ai/eval/run')
  @ApiOperation({
    summary:
      'Trigger a full run of the AI evaluation regression harness against Golden Dataset v2 (Admin only)',
  })
  async runAiEvaluation() {
    return this.evalHarnessService.runEvaluationHarness();
  }

  @Get('ai/eval/latest')
  @ApiOperation({
    summary:
      'Retrieve the latest AI evaluation harness report, slice metrics, and quality gate status (Admin only)',
  })
  async getLatestAiEvaluation() {
    return this.evalHarnessService.getLatestReport();
  }

  // --- Semantic Cache & LLM Health Endpoints (F013) ---

  @Get('llm/health')
  @ApiOperation({
    summary: 'Get LLM providers health, circuit breaker states, and priority chain (Admin only)',
  })
  async getLlmHealth() {
    return this.adminService.getLlmHealth();
  }

  @Post('llm/clear-cache')
  @UseGuards(MfaStepUpGuard)
  @ApiOperation({ summary: 'Invalidate all semantic cache entries (Admin with Step-Up only)' })
  async clearSemanticCache() {
    return this.adminService.clearSemanticCache();
  }

  @Get('llm/metrics')
  @ApiOperation({
    summary: 'Get semantic cache hit rate, size, and cost savings metrics (Admin only)',
  })
  async getSemanticCacheMetrics() {
    return this.adminService.getSemanticCacheMetrics();
  }
}
