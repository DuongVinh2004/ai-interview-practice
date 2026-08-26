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
    if (process.env.NODE_ENV === 'production') {
      this.logger.error('Stripe is not configured for production checkout');
      throw new DomainException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Payment processing is currently unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
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

  async createPayosPayment(
    userId: string,
    req: CreatePayosPaymentDto,
  ): Promise<PayosPaymentResponseDto> {
    const isProduction =
      process.env.NODE_ENV === 'production' ||
      this.configService.get<string>('app.env') === 'production' ||
      this.configService.get<string>('NODE_ENV') === 'production';
    if (isProduction && !this.payosProvider.isConfiguredProvider()) {
      this.logger.error('PayOS is not configured for production checkout');
      throw new DomainException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'VietQR payment processing is currently unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

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

    const isYearly = req.billingCycle === 'yearly';
    // Convert USD plan price to VND (~25,400 VND/USD rate) or use fixed VND packages
    const baseUsdPrice = isYearly ? Number(plan.priceYearly) : Number(plan.priceMonthly);
    const amountVnd = Math.round(baseUsdPrice * 25400);

    const orderCode = Number(
      `${Math.floor(Date.now() / 1000)}${Math.floor(100 + Math.random() * 900)}`,
    );

    const defaultReturnUrl = `${process.env.APP_URL || 'http://localhost:5173'}/billing?success=true`;
    const defaultCancelUrl = `${process.env.APP_URL || 'http://localhost:5173'}/billing?canceled=true`;

    const returnUrl = req.returnUrl ? this.validateRedirectUrl(req.returnUrl) : defaultReturnUrl;
    const cancelUrl = req.cancelUrl ? this.validateRedirectUrl(req.cancelUrl) : defaultCancelUrl;

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

    // Create durable pending invoice record for reconciliation (F-004 fix)
    await this.prisma.invoice.create({
      data: {
        userId,
        amountTotal: amountVnd,
        currency: 'VND',
        status: 'OPEN',
        stripeInvoiceId: `PAYOS_${orderCode}`,
        pdfUrl: JSON.stringify({ planSlug: plan.slug, billingCycle: req.billingCycle }),
      },
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

    const verifiedData = await this.payosProvider.verifyWebhookData(webhookBody);
    if (!verifiedData) {
      this.logger.warn(
        'PayOS webhook verification failed: invalid signature or unconfigured provider',
      );
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Invalid PayOS webhook signature or payload',
        HttpStatus.BAD_REQUEST,
      );
    }

    const { orderCode, amount, code, currency } = verifiedData;
    if (code !== '00') {
      this.logger.warn(`PayOS transaction code not success: ${code}`);
      return { success: false, message: `Transaction failed with code ${code}` };
    }

    // 1. Reconcile via durable Invoice ledger
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        stripeInvoiceId: `PAYOS_${orderCode}`,
      },
      orderBy: { issuedAt: 'desc' },
    });

    if (!existingInvoice) {
      this.logger.warn(`PayOS webhook received for unknown invoice/orderCode: ${orderCode}`);
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `No pending invoice found for PayOS order ${orderCode}`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Validate amount integrity against expected invoice amount before any idempotent branches
    if (Number(existingInvoice.amountTotal) !== Number(amount)) {
      this.logger.error(
        `PayOS order ${orderCode} amount mismatch: invoice expected ${existingInvoice.amountTotal}, webhook received ${amount}`,
      );
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Payment amount mismatch',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate currency integrity against expected invoice currency (PayOS is VND)
    const callbackCurrency = currency || 'VND';
    if (existingInvoice.currency !== callbackCurrency || callbackCurrency !== 'VND') {
      this.logger.error(
        `PayOS order ${orderCode} currency mismatch: invoice expected ${existingInvoice.currency}, webhook received ${callbackCurrency}`,
      );
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Payment currency mismatch',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Idempotent return for already-paid invoice ONLY after amount and currency validation
    if (existingInvoice.status === 'PAID') {
      this.logger.log(`PayOS order ${orderCode} was already processed and marked PAID`);
      return { success: true, message: 'PayOS webhook already processed' };
    }

    if (existingInvoice.status !== 'OPEN') {
      this.logger.warn(
        `PayOS order ${orderCode} invoice status is ${existingInvoice.status}, expected OPEN`,
      );
      return {
        success: false,
        message: `Invoice is not in OPEN status (current: ${existingInvoice.status})`,
      };
    }

    const userId = existingInvoice.userId;
    let targetPlanSlug = 'pro';
    let isYearly = false;

    if (existingInvoice.pdfUrl) {
      try {
        const meta = JSON.parse(existingInvoice.pdfUrl);
        targetPlanSlug = meta.planSlug || 'pro';
        isYearly = meta.billingCycle === 'yearly';
      } catch {
        // Fallback to defaults
      }
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { slug: targetPlanSlug },
    });

    if (!plan) {
      this.logger.error(
        `Subscription plan ${targetPlanSlug} not found for invoice ${existingInvoice.id}`,
      );
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Subscription plan ${targetPlanSlug} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const now = new Date();
    const periodEnd = new Date();
    if (isYearly) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    let subId: string | undefined;
    let transitionSucceeded = false;

    await this.prisma.$transaction(async tx => {
      // Atomic compare-and-set: update invoice from OPEN to PAID
      const invoiceUpdate = await (tx.invoice as any).updateMany({
        where: {
          id: existingInvoice.id,
          status: 'OPEN',
        },
        data: {
          status: 'PAID',
          pdfUrl: `https://ai-interview.dev/invoices/payos-${orderCode}.pdf`,
          paidAt: now,
        },
      });

      if (invoiceUpdate && invoiceUpdate.count === 0) {
        this.logger.warn(`Invoice ${existingInvoice.id} was concurrently modified or already paid`);
        return;
      }

      transitionSucceeded = true;

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

      if (existingInvoice) {
        await tx.invoice.update({
          where: { id: existingInvoice.id },
          data: {
            subscriptionId: subId,
            status: 'PAID',
            pdfUrl: `https://ai-interview.dev/invoices/payos-${orderCode}.pdf`,
            paidAt: now,
          },
        });
      }
    });

    if (!transitionSucceeded) {
      return { success: true, message: 'PayOS webhook already processed' };
    }

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
    return { success: true, message: 'PayOS webhook processed successfully' };
  }

  private validateRedirectUrl(urlStr: string): string {
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new DomainException(
          ErrorCode.VALIDATION_ERROR,
          `Malformed redirect URL: invalid protocol ${parsed.protocol}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const appUrl = process.env.APP_URL || 'http://localhost:5173';
      const allowedHosts = new Set([new URL(appUrl).hostname, 'localhost', '127.0.0.1']);

      const corsOrigin = process.env.CORS_ORIGIN;
      if (corsOrigin) {
        corsOrigin.split(',').forEach(o => {
          try {
            allowedHosts.add(new URL(o.trim()).hostname);
          } catch {
            this.logger.warn(`Ignoring invalid CORS_ORIGIN entry: ${o.trim()}`);
          }
        });
      }

      if (!allowedHosts.has(parsed.hostname)) {
        throw new DomainException(
          ErrorCode.VALIDATION_ERROR,
          `Invalid redirect URL host: ${parsed.hostname}. Host is not in allowed origins.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      return urlStr;
    } catch (err: any) {
      if (err instanceof DomainException) throw err;
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        `Malformed redirect URL: ${urlStr}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
