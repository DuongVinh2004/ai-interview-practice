import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@ai-interview/contracts';
import { ReadinessService } from './services/readiness.service';
import { WeightProfileService } from './services/weight-profile.service';
import { TierClassificationService } from './services/tier-classification.service';
import {
  CreateWeightProfileDto,
  ReadinessHistoryQueryDto,
  ReadinessQueryDto,
  UpdateTierDto,
} from './dto/readiness.dto';

@ApiTags('Readiness Score & Offer Predictor (F009)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ReadinessController {
  constructor(
    private readonly readinessService: ReadinessService,
    private readonly weightProfileService: WeightProfileService,
    private readonly tierClassificationService: TierClassificationService,
  ) {}

  @Get('profile/readiness')
  @ApiOperation({
    summary: 'Get candidate composite readiness score, confidence interval, and roadmap',
  })
  async getReadiness(@CurrentUser('sub') userId: string, @Query() query: ReadinessQueryDto) {
    return this.readinessService.getReadinessDashboard(userId, query.role || 'backend');
  }

  @Get('profile/readiness/history')
  @ApiOperation({ summary: 'Get candidate readiness progression time-series history' })
  async getReadinessHistory(
    @CurrentUser('sub') userId: string,
    @Query() query: ReadinessHistoryQueryDto,
  ) {
    return this.readinessService.getReadinessHistory(userId, query.period || '30d');
  }

  @Get('profile/readiness/compare')
  @ApiOperation({ summary: 'Compare candidate readiness across multiple target job roles' })
  async compareRoles(@CurrentUser('sub') userId: string) {
    return this.readinessService.compareRoles(userId);
  }

  @Get('admin/readiness/weight-profiles')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: List role readiness weight profiles' })
  async getWeightProfiles() {
    return this.weightProfileService.getAllProfiles();
  }

  @Post('admin/readiness/weight-profiles')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: Create or update weight profile' })
  async upsertWeightProfile(@Body() dto: CreateWeightProfileDto) {
    return this.weightProfileService.upsertWeightProfile(
      dto.jobRoleSlug,
      dto.competencyArea,
      dto.weight,
    );
  }

  @Get('admin/readiness/tiers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: List readiness tier definitions' })
  async getTiers() {
    return this.tierClassificationService.getAllTiers();
  }
}
