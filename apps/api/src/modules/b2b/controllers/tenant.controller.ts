import { Controller, Post, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TenantRoleGuard, RequireTenantRoles } from '../guards/tenant-role.guard';
import { TenantService } from '../services/tenant.service';
import { CreateTenantDto, UpdateBrandingDto, CreateApiKeyDto } from '../dto/b2b.dto';
import { TenantRole } from '@ai-interview/contracts';
import { RequestWithTenant } from '../middleware/tenant-context.middleware';

@ApiTags('B2B Organizations & Tenants (F011)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantRoleGuard)
@Controller()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post('tenants')
  @ApiOperation({ summary: 'Create a new B2B organization/tenant account' })
  async createTenant(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateTenantDto,
  ) {
    return this.tenantService.createTenant(userId, dto);
  }

  @Get('b2b/tenant/me')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN, TenantRole.INSTRUCTOR, TenantRole.STUDENT)
  @ApiOperation({ summary: 'Get details and branding of current tenant organization' })
  async getMyTenant(@Req() req: RequestWithTenant) {
    return this.tenantService.getTenant(req.tenantId!);
  }

  @Put('b2b/tenant/branding')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Update white-label branding, logo, and theme colors' })
  async updateBranding(
    @Req() req: RequestWithTenant,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.tenantService.updateBranding(req.tenantId!, dto.brandingConfig);
  }

  @Post('b2b/api-keys')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Issue API key for B2B LMS/SSO integration' })
  async createApiKey(
    @Req() req: RequestWithTenant,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.tenantService.createApiKey(req.tenantId!, dto.name);
  }

  @Get('b2b/api-keys')
  @RequireTenantRoles(TenantRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'List API keys for current organization' })
  async listApiKeys(@Req() req: RequestWithTenant) {
    return this.tenantService.listApiKeys(req.tenantId!);
  }
}
