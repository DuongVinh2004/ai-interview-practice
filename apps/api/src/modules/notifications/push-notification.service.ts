import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../platform/prisma/prisma.service';
import { PushSubscriptionDto, NotificationPreferenceDto } from '@ai-interview/contracts';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private isConfigured = false;

  constructor(private readonly prisma: PrismaService) {
    this.initVapid();
  }

  getIsConfigured(): boolean {
    return this.isConfigured;
  }

  initVapid(): void {
    const isProd = process.env.NODE_ENV === 'production';
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:support@ai-interview.com';

    if (!publicKey || !privateKey) {
      this.isConfigured = false;
      const message =
        'Web Push notifications are disabled because VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is missing.';
      if (isProd) {
        this.logger.error(`CRITICAL: ${message}`);
      } else {
        this.logger.warn(message);
      }
      return;
    }

    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.isConfigured = true;
      this.logger.log('Web Push VAPID configuration initialized.');
    } catch (err: any) {
      this.isConfigured = false;
      this.logger.warn(
        `Failed to initialize VAPID details: ${err.message}. Web push will run in simulated mode.`,
      );
    }
  }

  async subscribe(
    userId: string,
    dto: PushSubscriptionDto,
  ): Promise<{ success: boolean; id: string }> {
    const sub = await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        device: dto.device || 'Browser',
      },
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        device: dto.device || 'Browser',
      },
    });

    return { success: true, id: sub.id };
  }

  async unsubscribe(endpoint: string): Promise<{ success: boolean }> {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });
    return { success: true };
  }

  async getPreferences(userId: string): Promise<NotificationPreferenceDto> {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      return {
        dailyReminder: true,
        streakWarning: true,
        newFeatures: false,
        reminderTime: '20:00',
      };
    }

    return {
      dailyReminder: pref.dailyReminder,
      streakWarning: pref.streakWarning,
      newFeatures: pref.newFeatures,
      reminderTime: pref.reminderTime,
    };
  }

  async updatePreferences(
    userId: string,
    dto: NotificationPreferenceDto,
  ): Promise<NotificationPreferenceDto> {
    const pref = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        dailyReminder: dto.dailyReminder,
        streakWarning: dto.streakWarning,
        newFeatures: dto.newFeatures,
        reminderTime: dto.reminderTime,
      },
      update: {
        dailyReminder: dto.dailyReminder,
        streakWarning: dto.streakWarning,
        newFeatures: dto.newFeatures,
        reminderTime: dto.reminderTime,
      },
    });

    return {
      dailyReminder: pref.dailyReminder,
      streakWarning: pref.streakWarning,
      newFeatures: pref.newFeatures,
      reminderTime: pref.reminderTime,
    };
  }

  async sendToUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      icon?: string;
      badge?: string;
      url?: string;
      data?: any;
    },
  ): Promise<{ sentCount: number; failedCount: number }> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      this.logger.debug(`No push subscriptions found for user ${userId}`);
      return { sentCount: 0, failedCount: 0 };
    }

    let sentCount = 0;
    let failedCount = 0;

    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/pwa-192x192.png',
      badge: payload.badge || '/badge-icon.png',
      url: payload.url || '/dashboard',
      data: payload.data || {},
    });

    const sendPromises = subscriptions.map(async sub => {
      try {
        if (this.isConfigured) {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payloadString,
          );
        }
        sentCount++;
      } catch (err: any) {
        failedCount++;
        this.logger.warn(`Push delivery error to endpoint ${sub.id}: ${err.message}`);
        // If subscription has expired or unsubscribed (410 Gone / 404 Not Found), clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    });

    await Promise.all(sendPromises);
    return { sentCount, failedCount };
  }

  async sendStreakWarning(userId: string, currentStreak: number): Promise<void> {
    await this.sendToUser(userId, {
      title: '🔥 Giữ vững chuỗi ngày học tập!',
      body: `Bạn đang có chuỗi ${currentStreak} ngày liên tiếp. Hãy hoàn thành 1 bài luyện tập hôm nay để không bị gián đoạn!`,
      url: '/flashcards',
    });
  }
}
