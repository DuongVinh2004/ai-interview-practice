import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole, UserStatus } from '@ai-interview/contracts';
import { LockUserRequestDto } from './dto/admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
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

  @Post(':id/lock')
  @ApiOperation({ summary: 'Soft-lock a user account (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID to lock' })
  async lockUser(
    @CurrentUser('sub') adminId: string,
    @Param('id') targetUserId: string,
    @Body() dto: LockUserRequestDto,
  ) {
    return this.adminService.lockUser(adminId, targetUserId, dto.reason);
  }

  @Post(':id/unlock')
  @ApiOperation({ summary: 'Unlock a soft-locked user account (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID to unlock' })
  async unlockUser(@CurrentUser('sub') adminId: string, @Param('id') targetUserId: string) {
    return this.adminService.unlockUser(adminId, targetUserId);
  }
}
