import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PortfolioService } from '../services/portfolio.service';
import { BadgeService } from '../services/badge.service';
import { UpdatePortfolioSettingsDto } from '../dto/portfolio.dto';

@ApiTags('Portfolio & Badges (F010)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PortfolioController {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly badgeService: BadgeService,
  ) {}

  @Get('portfolio/settings')
  @ApiOperation({ summary: 'Get current user portfolio visibility and profile settings' })
  async getSettings(@CurrentUser('sub') userId: string) {
    return this.portfolioService.getUserPortfolioSettings(userId);
  }

  @Put('portfolio/settings')
  @ApiOperation({ summary: 'Update portfolio username, bio, and visibility flags' })
  async updateSettings(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdatePortfolioSettingsDto,
  ) {
    return this.portfolioService.updatePortfolioSettings(userId, dto);
  }

  @Get('profile/badges')
  @ApiOperation({ summary: 'Get user badge inventory, tier levels, and unlock progress' })
  async getBadges(@CurrentUser('sub') userId: string) {
    return this.badgeService.getUserBadgeProgress(userId);
  }
}
