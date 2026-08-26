import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PushNotificationService } from './push-notification.service';
import { StreakReminderCron } from './streak-reminder.cron';
import { DataRetentionCron } from '../platform/cron/data-retention.cron';
import { NotificationController } from './notification.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [ScheduleModule.forRoot(), StorageModule],
  controllers: [NotificationController],
  providers: [PushNotificationService, StreakReminderCron, DataRetentionCron],
  exports: [PushNotificationService, DataRetentionCron],
})
export class NotificationModule {}
