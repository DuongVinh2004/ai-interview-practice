import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TenantRoleGuard, RequireTenantRoles } from '../guards/tenant-role.guard';
import { TenantRole, ArenaChallengeManifest } from '@ai-interview/contracts';
import { B2bChallengeService } from '../services/b2b-challenge.service';

export class CreateB2bChallengeDto {
  manifest!: ArenaChallengeManifest;
  visibleFilesContent!: Record<string, string>;
  hiddenFilesContent!: Record<string, string>;
}

@ApiTags('B2B Enterprise Challenge Authoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRoleGuard)
@Controller('b2b/challenges')
export class B2bChallengeController {
  constructor(private readonly b2bChallengeService: B2bChallengeService) {}

  @Post('validate')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate custom challenge package against 6-stage CI criteria' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Validation report' })
  async validateChallenge(@Body() body: CreateB2bChallengeDto) {
    return this.b2bChallengeService.validateChallenge(body);
  }

  @Post()
  @RequireTenantRoles(TenantRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create custom challenge draft for tenant' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Challenge created' })
  async createChallenge(
    @CurrentUser('id') userId: string,
    @Req() req: any,
    @Body() body: CreateB2bChallengeDto,
  ) {
    const tenantId = req.tenantId;
    return this.b2bChallengeService.createCustomChallenge({
      tenantId,
      userId,
      manifest: body.manifest,
      visibleFilesContent: body.visibleFilesContent,
      hiddenFilesContent: body.hiddenFilesContent,
    });
  }

  @Get()
  @RequireTenantRoles(TenantRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'List custom challenges authored by tenant' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of custom challenges' })
  async listChallenges(@CurrentUser('id') userId: string, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.b2bChallengeService.listTenantChallenges(tenantId, userId);
  }

  @Get(':id')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Get custom challenge detail by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Custom challenge detail' })
  async getChallenge(
    @CurrentUser('id') userId: string,
    @Req() req: any,
    @Param('id') challengeId: string,
  ) {
    const tenantId = req.tenantId;
    return this.b2bChallengeService.getTenantChallenge(challengeId, tenantId, userId);
  }

  @Post(':id/publish')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish and activate custom challenge' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Challenge published' })
  async publishChallenge(
    @CurrentUser('id') userId: string,
    @Req() req: any,
    @Param('id') challengeId: string,
  ) {
    const tenantId = req.tenantId;
    return this.b2bChallengeService.publishTenantChallenge(challengeId, tenantId, userId);
  }
}
