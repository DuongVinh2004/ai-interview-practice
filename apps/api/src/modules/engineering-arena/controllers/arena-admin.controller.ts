import { Controller, Post, Body, Param, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ArenaAdminService } from '../services/arena-admin.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole, ArenaChallengeManifest } from '@ai-interview/contracts';

@ApiTags('Admin - Engineering Arena')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/arena')
export class ArenaAdminController {
  constructor(private readonly adminService: ArenaAdminService) {}

  @Post('challenges')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new challenge draft with validation (Admin only)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Draft created' })
  async createChallengeDraft(
    @CurrentUser('id') adminId: string,
    @Body()
    body: {
      manifest: ArenaChallengeManifest;
      visibleFilesContent: Record<string, string>;
      hiddenFilesContent: Record<string, string>;
    },
  ) {
    return this.adminService.createChallengeDraft({
      manifest: body.manifest,
      adminId,
      visibleFilesContent: body.visibleFilesContent,
      hiddenFilesContent: body.hiddenFilesContent,
    });
  }

  @Post('versions/:versionId/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a validated challenge version (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Version activated' })
  async activateVersion(@Param('versionId') versionId: string) {
    return this.adminService.activateVersion(versionId);
  }

  @Post('versions/:versionId/deprecate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deprecate a challenge version (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Version deprecated' })
  async deprecateVersion(@Param('versionId') versionId: string) {
    return this.adminService.deprecateVersion(versionId);
  }
}
