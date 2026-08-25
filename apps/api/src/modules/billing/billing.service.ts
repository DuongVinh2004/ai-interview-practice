import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import {
  ErrorCode,
  AuditAction,
  SubscriptionPlanDto,
  SubscriptionResponse,
  InvoiceDto,
  CreateCheckoutRequest,
  CheckoutResponse,
  SubscriptionStatus,
  CreatePayosPaymentDto,
  PayosPaymentResponseDto,
} from '@ai-interview/contracts';
import { MockBillingProvider } from './providers/mock-billing.provider';
import { StripeProvider } from './providers/stripe.provider';
import { PayosProvider } from './providers/payos.provider';
import { UsageMeterService } from './usage-meter.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mockBilling: MockBillingProvider,
    private readonly stripeBilling: StripeProvider,
    private readonly payosProvider: PayosProvider,
    private readonly usageMeter: UsageMeterService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private getProvider() {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY', '');
    if (stripeKey) {
      return this.stripeBilling;
    }
    return this.mockBilling;
  }

  async listPlans(): Promise<SubscriptionPlanDto[]> {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });

    return plans.map(p => this.mapPlanToDto(p));
  }

  private mapPlanToDto(p: any): SubscriptionPlanDto {
    const limits = (p.limits as any) || {};
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      nameVi: p.nameVi,
      description: p.description || '',
      priceMonthly: Number(p.priceMonthly) || 0,
      priceYearly: Number(p.priceYearly) || 0,
      currency: p.currency || 'USD',
      features: (p.features as string[]) || [],
      limits: {
        sessionsPerMonth: limits.sessionsPerMonth || 3,
        voiceMinutesPerMonth: limits.voiceMinutesPerMonth || 15,
        allowLiveCoding: limits.allowLiveCoding ?? true,
        allowSystemDesign: limits.allowSystemDesign ?? true,
        mentorFeedbackLimit: limits.mentorFeedbackLimit ?? 1,
      },
      stripePriceIdMonthly: p.stripePriceIdMonthly || undefined,
      stripePriceIdYearly: p.stripePriceIdYearly || undefined,
      isActive: p.isActive,
    };
  }

  async getSubscription(userId: string): Promise<SubscriptionResponse | null> {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
      // Default to FREE plan
      const freePlan = await this.prisma.subscriptionPlan.findUnique({
        where: { slug: 'free' },
      });

      if (!freePlan) return null;

      return {
        id: '00000000-0000-0000-0000-000000000000',
        userId,
        plan: this.mapPlanToDto(freePlan),
        status: SubscriptionStatus.ACTIVE,
        provider: 'MOCK',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
      };
    }

    return {
      id: sub.id,
      userId: sub.userId,
      plan: this.mapPlanToDto(sub.plan),
      status: sub.status as any,
      provider: sub.provider,
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      canceledAt: sub.canceledAt?.toISOString() || null,
    };
  }

  async createCheckout(userId: string, req: CreateCheckoutRequest): Promise<CheckoutResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { slug: req.planSlug },
    });

    if (!plan) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Subscription plan not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const provider = this.getProvider();
    const stripePriceId =
      req.billingCycle === 'yearly'
        ? plan.stripePriceIdYearly || plan.stripePriceIdMonthly
        : plan.stripePriceIdMonthly;

    const result = await provider.createCheckoutSession(
      userId,
      user.email,
      req,
      stripePriceId || undefined,
    );

    // If Mock provider, activate subscription
    if (provider.name === 'mock') {
      const now = new Date();
      const periodEnd = new Date();
      const isYearly = req.billingCycle === 'yearly';
      if (isYearly) {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      await this.prisma.$transaction(async tx => {
        const existingSub = await tx.subscription.findFirst({
          where: { userId },
        });

        let subId = existingSub?.id;
        if (existingSub) {
          await tx.subscription.update({
            where: { id: existingSub.id },
            data: {
              planId: plan.id,
              status: SubscriptionStatus.ACTIVE as any,
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
            },
          });
        } else {
          const created = await tx.subscription.create({
            data: {
              userId,
              planId: plan.id,
              status: SubscriptionStatus.ACTIVE as any,
              provider: 'MOCK',
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
            },
          });
          subId = created.id;
        }

        // Create initial invoice
        await tx.invoice.create({
          data: {
            userId,
            subscriptionId: subId,
            amountTotal: isYearly ? plan.priceYearly : plan.priceMonthly,
            currency: 'USD',
            status: 'PAID',
            pdfUrl: 'https://ai-interview.dev/mock-invoice.pdf',
            paidAt: now,
          },
        });
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.SUBSCRIPTION_CREATED,
        resource: 'subscription',
        resourceId: plan.id,
        details: { planSlug: plan.slug, billingCycle: req.billingCycle },
      },
    });

    return result;
  }

  async cancelSubscription(userId: string): Promise<SubscriptionResponse> {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'No active subscription found to cancel',
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
      include: { plan: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.SUBSCRIPTION_CANCELED,
        resource: 'subscription',
        resourceId: sub.id,
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      plan: this.mapPlanToDto(updated.plan),
      status: updated.status as any,
      provider: updated.provider,
      currentPeriodStart: updated.currentPeriodStart.toISOString(),
      currentPeriodEnd: updated.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
      canceledAt: updated.canceledAt?.toISOString() || null,
    };
  }

  async getInvoices(userId: string): Promise<InvoiceDto[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
    });

    return invoices.map(i => ({
      id: i.id,
      subscriptionId: i.subscriptionId || undefined,
      amountTotal: Number(i.amountTotal),
      currency: i.currency,
      status: i.status as any,
      pdfUrl: i.pdfUrl || undefined,
      issuedAt: i.issuedAt.toISOString(),
      paidAt: i.paidAt?.toISOString(),
    }));
  }

  async validatePromoCode(
    code: string,
  ): Promise<{ valid: boolean; discountPercent: number; code: string }> {
    const promo = await this.prisma.promoCode.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!promo || !promo.isActive) {
      return { valid: false, discountPercent: 0, code };
    }

    if (promo.expiresAt && promo.expiresAt < new Date()) {
      return { valid: false, discountPercent: 0, code };
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return { valid: false, discountPercent: 0, code };
    }

    return {
      valid: true,
      discountPercent: Number(promo.discountValue),
      code: promo.code,
    };
  }

  async createPayosPayment(userId: string, req: CreatePayosPaymentDto): Promise<PayosPaymentResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new DomainException(ErrorCode.RESOURCE_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { slug: req.planSlug },
    });

    if (!plan) {
      throw new DomainException(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription plan not found', HttpStatus.NOT_FOUND);
    }

    const isYearly = req.billingCycle === 'yearly';
    // Convert USD plan price to VND (~25,400 VND/USD rate) or use fixed VND packages
    const baseUsdPrice = isYearly ? Number(plan.priceYearly) : Number(plan.priceMonthly);
    const amountVnd = Math.round(baseUsdPrice * 25400);

    const orderCode = Number(`${Date.now()}`.slice(-6)) + Math.floor(Math.random() * 1000);
    const returnUrl = req.returnUrl || `${process.env.APP_URL || 'http://localhost:5173'}/billing?success=true`;
    const cancelUrl = req.cancelUrl || `${process.env.APP_URL || 'http://localhost:5173'}/billing?canceled=true`;

    const description = `AI INT ${plan.slug.toUpperCase()}`;

    const paymentResponse = await this.payosProvider.createPaymentLink({
      orderCode,
      amount: amountVnd,
      description,
      returnUrl,
      cancelUrl,
      items: [
        {
          name: `${plan.name} (${isYearly ? 'Yearly' : 'Monthly'})`,
          quantity: 1,
          price: amountVnd,
        },
      ],
    });

    // Record audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.SUBSCRIPTION_CREATED,
        resource: 'subscription_payos',
        resourceId: plan.id,
        details: { orderCode, amountVnd, planSlug: plan.slug, billingCycle: req.billingCycle },
      },
    });

    return paymentResponse;
  }

  async handlePayosWebhook(webhookBody: any): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Processing PayOS VietQR Webhook notification`);

    const verifiedData = this.payosProvider.verifyWebhookData(webhookBody);
    if (!verifiedData) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Invalid PayOS webhook signature or payload',
        HttpStatus.BAD_REQUEST,
      );
    }

    const { orderCode, amount, code } = verifiedData;
    if (code !== '00') {
      this.logger.warn(`PayOS transaction code not success: ${code}`);
      return { success: false, message: `Transaction failed with code ${code}` };
    }

    // Find audit log with matching orderCode to locate user and plan
    const audit = await this.prisma.auditLog.findFirst({
      where: {
        action: AuditAction.SUBSCRIPTION_CREATED,
        resource: 'subscription_payos',
        details: {
          path: ['orderCode'],
          equals: orderCode,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (audit && audit.userId) {
      const userId: string = audit.userId;
      const details = audit.details as any;
      const planSlug = details?.planSlug || 'pro';
      const isYearly = details?.billingCycle === 'yearly';

      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { slug: planSlug },
      });

      if (plan) {
        const now = new Date();
        const periodEnd = new Date();
        if (isYearly) {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        let subId: string | undefined;

        await this.prisma.$transaction(async tx => {
          const existingSub = await tx.subscription.findFirst({
            where: { userId },
          });

          if (existingSub) {
            const updated = await tx.subscription.update({
              where: { id: existingSub.id },
              data: {
                planId: plan.id,
                status: SubscriptionStatus.ACTIVE as any,
                provider: 'PAYOS',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false,
              },
            });
            subId = updated.id;
          } else {
            const created = await tx.subscription.create({
              data: {
                userId,
                planId: plan.id,
                status: SubscriptionStatus.ACTIVE as any,
                provider: 'PAYOS',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
              },
            });
            subId = created.id;
          }

          // Create paid Invoice
          await tx.invoice.create({
            data: {
              userId,
              subscriptionId: subId,
              amountTotal: amount,
              currency: 'VND',
              status: 'PAID',
              pdfUrl: `https://ai-interview.dev/invoices/payos-${orderCode}.pdf`,
              paidAt: now,
            },
          });
        });

        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { profile: true },
        });

        // Emit billing.payment_succeeded event to send confirmation receipt email
        this.eventEmitter.emit('billing.payment_succeeded', {
          userId,
          email: user?.email || '',
          userName: user?.profile?.fullName || 'Valued Member',
          planName: plan.name,
          amount,
          currency: 'VND',
          paymentMethod: 'VietQR (PayOS)',
          invoiceId: `INV-PAYOS-${orderCode}`,
          paidAt: now.toISOString().split('T')[0],
        });

        this.logger.log(`Successfully activated PayOS VietQR subscription for user ${userId}`);
      }
    }

    return { success: true, message: 'PayOS webhook processed successfully' };
  }
}

