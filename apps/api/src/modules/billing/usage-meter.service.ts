import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import {
  BillingMetric,
  UsageSummary,
} from '@ai-interview/contracts';

const FREE_LIMITS: Record<BillingMetric, number> = {
  [BillingMetric.SESSION_COUNT]: 3,
  [BillingMetric.AI_TOKEN]: 50000,
  [BillingMetric.AUDIO_MINUTE]: 15,
};

@Injectable()
export class UsageMeterService {
  private readonly logger = new Logger(UsageMeterService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkQuota(
    userId: string,
    metric: BillingMetric,
  ): Promise<{ allowed: boolean; currentUsage: number; limit: number; remaining: number }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { plan: true },
    });

    let limit = FREE_LIMITS[metric] || 10;
    if (subscription) {
      const limits = subscription.plan.limits as any;
      if (metric === BillingMetric.SESSION_COUNT) {
        limit = limits?.sessionsPerMonth || 20;
      } else if (metric === BillingMetric.AI_TOKEN) {
        limit = 200000;
      } else if (metric === BillingMetric.AUDIO_MINUTE) {
        limit = limits?.voiceMinutesPerMonth || 60;
      }
    }

    const records = await this.prisma.usageRecord.aggregate({
      where: {
        userId,
        metric,
        recordedAt: { gte: startOfMonth },
      },
      _sum: { quantity: true },
    });

    const currentUsage = records._sum.quantity || 0;
    const remaining = Math.max(0, limit - currentUsage);
    const allowed = currentUsage < limit;

    return {
      allowed,
      currentUsage,
      limit,
      remaining,
    };
  }

  async recordUsage(
    userId: string,
    metric: BillingMetric,
    quantity: number,
  ): Promise<void> {
    await this.prisma.usageRecord.create({
      data: {
        userId,
        metric,
        quantity,
      },
    });
  }

  async getUsageSummary(userId: string): Promise<UsageSummary> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const sessionQuota = await this.checkQuota(userId, BillingMetric.SESSION_COUNT);
    const tokenQuota = await this.checkQuota(userId, BillingMetric.AI_TOKEN);
    const audioQuota = await this.checkQuota(userId, BillingMetric.AUDIO_MINUTE);

    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { plan: true },
    });

    return {
      sessionsUsed: sessionQuota.currentUsage,
      sessionsLimit: sessionQuota.limit,
      voiceMinutesUsed: audioQuota.currentUsage,
      voiceMinutesLimit: audioQuota.limit,
      aiTokensUsed: tokenQuota.currentUsage,
      billingPeriodStart: startOfMonth.toISOString(),
      billingPeriodEnd: endOfMonth.toISOString(),
      planSlug: sub?.plan?.slug || 'free',
      isQuotaExceeded: !sessionQuota.allowed,
    };
  }
}
