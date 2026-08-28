import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { BillingService } from '../../billing/billing.service';
import { QuestionBankAccessStatusDto } from '@ai-interview/contracts';

export interface EffectiveEntitlement {
  planSlug: string;
  planName: string;
  browseAllowed: boolean;
  advancedFiltersAllowed: boolean;
  expertContentAllowed: boolean;
  rubricsAllowed: boolean;
  revealsLimit: number | 'unlimited';
  revealsUsed: number;
  revealsRemaining: number | 'unlimited';
  periodResetsAt: string;
  accessPeriodKey: string;
}

@Injectable()
export class QuestionBankEntitlementService {
  private readonly logger = new Logger(QuestionBankEntitlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  /**
   * Generates a deterministic access period key for quota isolation.
   */
  computeAccessPeriodKey(
    sub: any | null,
    now: Date = new Date(),
  ): { periodKey: string; resetsAt: string } {
    if (sub && sub.status === 'ACTIVE' && sub.id !== '00000000-0000-0000-0000-000000000000') {
      const periodStartStr = sub.currentPeriodStart
        ? new Date(sub.currentPeriodStart).toISOString().slice(0, 10)
        : now.toISOString().slice(0, 10);
      const periodEnd = sub.currentPeriodEnd
        ? new Date(sub.currentPeriodEnd).toISOString()
        : new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      return {
        periodKey: `sub_${sub.id}_${periodStartStr}`,
        resetsAt: periodEnd,
      };
    }

    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const nextMonthFirst = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0),
    );

    return {
      periodKey: `month_${year}-${month}`,
      resetsAt: nextMonthFirst.toISOString(),
    };
  }

  /**
   * Resolves the effective entitlements, quota limits, current usage and remaining balance for a user.
   */
  async getEffectiveEntitlement(userId: string): Promise<EffectiveEntitlement> {
    const sub = await this.billingService.getSubscription(userId);
    const planSlug = (sub?.plan?.slug || 'free').toLowerCase();
    const planName = sub?.plan?.name || 'Free Plan';

    const { periodKey, resetsAt } = this.computeAccessPeriodKey(sub);

    // Baseline limits by tier
    const browseAllowed = true;
    let advancedFiltersAllowed = false;
    let expertContentAllowed = false;
    let rubricsAllowed = false;
    let revealsLimit: number | 'unlimited' = 5; // Free: 5 per month

    if (planSlug === 'pro') {
      advancedFiltersAllowed = true;
      expertContentAllowed = true;
      rubricsAllowed = true;
      revealsLimit = 50; // Pro: 50 per month
    } else if (planSlug === 'team' || planSlug === 'enterprise') {
      advancedFiltersAllowed = true;
      expertContentAllowed = true;
      rubricsAllowed = true;
      revealsLimit = 'unlimited';
    }

    // Count usage records for current access period
    const usageAggregate = await this.prisma.questionBankUsageLedger.aggregate({
      where: {
        userId,
        accessPeriodKey: periodKey,
        entitlementKey: 'question_bank.answer_reveals',
      },
      _sum: { quantity: true },
    });

    const revealsUsed = usageAggregate._sum.quantity || 0;
    const revealsRemaining: number | 'unlimited' =
      revealsLimit === 'unlimited' ? 'unlimited' : Math.max(0, revealsLimit - revealsUsed);

    return {
      planSlug,
      planName,
      browseAllowed,
      advancedFiltersAllowed,
      expertContentAllowed,
      rubricsAllowed,
      revealsLimit,
      revealsUsed,
      revealsRemaining,
      periodResetsAt: resetsAt,
      accessPeriodKey: periodKey,
    };
  }

  /**
   * Checks if user has quota or existing grant to reveal an answer.
   */
  async canRevealAnswer(
    userId: string,
    questionId: string,
    answerId: string,
  ): Promise<{
    allowed: boolean;
    existingGrant: boolean;
    entitlement: EffectiveEntitlement;
    reason?: string;
  }> {
    const entitlement = await this.getEffectiveEntitlement(userId);

    // Check if user already has an active grant in this period
    const existingGrant = await this.prisma.questionAnswerAccessGrant.findUnique({
      where: {
        userId_questionId_answerId_accessPeriodKey: {
          userId,
          questionId,
          answerId,
          accessPeriodKey: entitlement.accessPeriodKey,
        },
      },
    });

    if (existingGrant) {
      return {
        allowed: true,
        existingGrant: true,
        entitlement,
      };
    }

    // New reveal requires quota
    if (
      entitlement.revealsLimit !== 'unlimited' &&
      entitlement.revealsUsed >= entitlement.revealsLimit
    ) {
      return {
        allowed: false,
        existingGrant: false,
        entitlement,
        reason: 'Monthly question bank reveal quota exhausted',
      };
    }

    return {
      allowed: true,
      existingGrant: false,
      entitlement,
    };
  }
}
