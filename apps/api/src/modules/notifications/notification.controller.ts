import { Controller, Get, Post, Put, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MfaStepUpGuard } from '../auth/guards/mfa-step-up.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PushNotificationService } from './push-notification.service';
import { StreakReminderCron } from './streak-reminder.cron';
import { PushSubscriptionDto, NotificationPreferenceDto, UserRole } from '@ai-interview/contracts';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly pushService: PushNotificationService,
    private readonly streakCron: StreakReminderCron,
  ) {}

  @Get('preferences')
  async getPreferences(@CurrentUser('sub') userId: string) {
    return this.pushService.getPreferences(userId);
  }

  @Put('preferences')
  async updatePreferences(
    @CurrentUser('sub') userId: string,
    @Body() dto: NotificationPreferenceDto,
  ) {
    return this.pushService.updatePreferences(userId, dto);
  }

  @Post('push/subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(@CurrentUser('sub') userId: string, @Body() dto: PushSubscriptionDto) {
    return this.pushService.subscribe(userId, dto);
  }

  @Post('push/unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Body() body: { endpoint: string }) {
    return this.pushService.unsubscribe(body.endpoint);
  }

  @Post('push/test')
  @HttpCode(HttpStatus.OK)
  async sendTestPush(@CurrentUser('sub') userId: string) {
    return this.pushService.sendToUser(userId, {
      title: '🎉 Thông báo thử nghiệm thành công!',
      body: 'Bạn đã kích hoạt thành công thông báo đẩy từ hệ thống Luyện Phỏng Vấn AI.',
      url: '/dashboard',
    });
  }

  @Post('cron/trigger-streak-check')
  @UseGuards(RolesGuard, MfaStepUpGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async triggerStreakCheck() {
    const count = await this.streakCron.triggerManualRun();
    return { triggeredCount: count };
  }
}
