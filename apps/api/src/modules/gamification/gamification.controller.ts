import { Controller, Get, Post, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { XpService } from './xp.service';
import { BadgeService } from './badge.service';
import { StreakService } from './streak.service';

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(
    private readonly xpService: XpService,
    private readonly badgeService: BadgeService,
    private readonly streakService: StreakService,
  ) {}

  @Get('profile')
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.xpService.getGamificationProfile(userId);
  }

  @Get('badges')
  async getBadges(@CurrentUser('sub') userId: string) {
    return this.badgeService.getAllBadges(userId);
  }

  @Get('leaderboard')
  async getLeaderboard(@CurrentUser('sub') userId: string, @Query('limit') limitStr?: string) {
    const limit = limitStr ? Math.min(50, Math.max(1, parseInt(limitStr, 10))) : 10;
    return this.xpService.getLeaderboard(limit, userId);
  }

  @Get('history')
  async getHistory(
    @CurrentUser('sub') userId: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const limit = limitStr ? Math.min(100, Math.max(1, parseInt(limitStr, 10))) : 20;
    const offset = offsetStr ? Math.max(0, parseInt(offsetStr, 10)) : 0;
    return this.xpService.getHistory(userId, limit, offset);
  }

  @Post('claim-daily-login')
  @HttpCode(HttpStatus.OK)
  async claimDailyLogin(@CurrentUser('sub') userId: string) {
    return this.xpService.claimDailyLogin(userId);
  }

  @Post('use-freeze')
  @HttpCode(HttpStatus.OK)
  async useFreeze(@CurrentUser('sub') userId: string) {
    return this.streakService.useStreakFreeze(userId);
  }
}
