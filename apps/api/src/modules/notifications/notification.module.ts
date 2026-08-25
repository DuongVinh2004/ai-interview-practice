import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PushNotificationService } from './push-notification.service';
import { StreakReminderCron } from './streak-reminder.cron';
import { NotificationController } from './notification.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [NotificationController],
  providers: [PushNotificationService, StreakReminderCron],
  exports: [PushNotificationService],
})
export class NotificationModule {}
