import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushNotificationService } from './push-notification.service';
import { StreakReminderCron } from './streak-reminder.cron';
import {
  PushSubscriptionDto,
  NotificationPreferenceDto,
} from '@ai-interview/contracts';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly pushService: PushNotificationService,
    private readonly streakCron: StreakReminderCron,
  ) {}

  @Get('preferences')
  async getPreferences(@Req() req: any) {
    const userId = req.user.id || req.user.userId;
    return this.pushService.getPreferences(userId);
  }

  @Put('preferences')
  async updatePreferences(@Req() req: any, @Body() dto: NotificationPreferenceDto) {
    const userId = req.user.id || req.user.userId;
    return this.pushService.updatePreferences(userId, dto);
  }

  @Post('push/subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(@Req() req: any, @Body() dto: PushSubscriptionDto) {
    const userId = req.user.id || req.user.userId;
    return this.pushService.subscribe(userId, dto);
  }

  @Post('push/unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Body() body: { endpoint: string }) {
    return this.pushService.unsubscribe(body.endpoint);
  }

  @Post('push/test')
  @HttpCode(HttpStatus.OK)
  async sendTestPush(@Req() req: any) {
    const userId = req.user.id || req.user.userId;
    return this.pushService.sendToUser(userId, {
      title: '🎉 Thông báo thử nghiệm thành công!',
      body: 'Bạn đã kích hoạt thành công thông báo đẩy từ hệ thống Luyện Phỏng Vấn AI.',
      url: '/dashboard',
    });
  }

  @Post('cron/trigger-streak-check')
  @HttpCode(HttpStatus.OK)
  async triggerStreakCheck() {
    const count = await this.streakCron.triggerManualRun();
    return { triggeredCount: count };
  }
}
