import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../platform/prisma/prisma.service';
import * as crypto from 'crypto';
import { BillingProvider } from '../interfaces/billing-provider.interface';
import { CreateCheckoutRequest, CheckoutResponse } from '@ai-interview/contracts';

@Injectable()
export class StripeProvider implements BillingProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripeProvider.name);
  private readonly apiKey: string;
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {
    this.apiKey = this.configService.get<string>('STRIPE_SECRET_KEY', '');
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET', '');
  }

  async createCheckoutSession(
    userId: string,
    userEmail: string,
    req: CreateCheckoutRequest,
    stripePriceId?: string,
  ): Promise<CheckoutResponse> {
    const successUrl = req.successUrl || 'https://ai-interview.dev/billing/success';
    const cancelUrl = req.cancelUrl || 'https://ai-interview.dev/billing';

    if (!this.apiKey) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('Stripe API Key missing in production environment');
        throw new BadRequestException('Payment processing is currently unavailable in production');
      }
      this.logger.warn('Stripe API Key missing. Falling back to dev mock checkout session.');
      const mockSessionId = `mock_stripe_${Date.now()}`;
      return {
        checkoutUrl: `${successUrl}?session_id=${mockSessionId}`,
        sessionId: mockSessionId,
      };
    }

    try {
      const params: Record<string, string> = {
        mode: 'subscription',
        customer_email: userEmail,
        'metadata[userId]': userId,
        'metadata[planSlug]': req.planSlug,
        success_url: successUrl,
        cancel_url: cancelUrl,
      };

      if (stripePriceId) {
        params['line_items[0][price]'] = stripePriceId;
        params['line_items[0][quantity]'] = '1';
      }

      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      });

      if (!response.ok) {
        throw new Error(`Stripe API returned status ${response.status}`);
      }

      const session = (await response.json()) as any;
      return {
        checkoutUrl: session.url || `${successUrl}?session_id=${session.id}`,
        sessionId: session.id,
      };
    } catch (err: any) {
      this.logger.error(`Stripe checkout creation failed: ${err.message}`);
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException('Failed to initialize payment checkout session');
      }
      return {
        checkoutUrl: cancelUrl,
        sessionId: 'error_session',
      };
    }
  }

  async cancelSubscriptionImmediately(providerSubscriptionId: string): Promise<void> {
    if (!this.apiKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException('Stripe cancellation is unavailable in production');
      }
      return;
    }

    const response = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(providerSubscriptionId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.apiKey}` },
      },
    );
    if (!response.ok && response.status !== 404) {
      throw new BadRequestException(
        `Stripe subscription cancellation failed with status ${response.status}`,
      );
    }
  }

  async createCustomerPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    if (!this.apiKey) {
      return { url: returnUrl };
    }

    try {
      const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          customer: customerId,
          return_url: returnUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`Stripe Portal returned status ${response.status}`);
      }

      const portal = (await response.json()) as any;
      return { url: portal.url || returnUrl };
    } catch (err: any) {
      this.logger.error(`Stripe portal session failed: ${err.message}`);
      return { url: returnUrl };
    }
  }

  verifyWebhookSignature(payloadString: string, signatureHeader?: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET is not configured. Rejecting unverified webhook.');
      return false;
    }
    if (!signatureHeader) {
      return false;
    }

    try {
      const parts = signatureHeader.split(',');
      let timestamp = '';
      const signatures: string[] = [];

      for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 't') timestamp = value;
        if (key === 'v1') signatures.push(value);
      }

      if (!timestamp || signatures.length === 0) {
        return false;
      }

      // 5-minute timestamp tolerance check
      const eventTime = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      if (isNaN(eventTime) || Math.abs(currentTime - eventTime) > 300) {
        this.logger.warn(
          `Stripe webhook timestamp tolerance exceeded (${currentTime - eventTime}s)`,
        );
        return false;
      }

      const signedPayload = `${timestamp}.${payloadString}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(signedPayload, 'utf8')
        .digest('hex');

      return signatures.some(sig => {
        try {
          return crypto.timingSafeEqual(
            Buffer.from(sig, 'hex'),
            Buffer.from(expectedSignature, 'hex'),
          );
        } catch {
          return false;
        }
      });
    } catch (err: any) {
      this.logger.error(`Error verifying Stripe webhook signature: ${err.message}`);
      return false;
    }
  }

  async handleWebhook(
    payload: any,
    signature?: string,
    rawBody?: string,
  ): Promise<{ eventType: string; handled: boolean; data?: any }> {
    const payloadStr = rawBody || (typeof payload === 'string' ? payload : JSON.stringify(payload));

    if (!this.webhookSecret) {
      this.logger.error(
        'STRIPE_WEBHOOK_SECRET is not configured. Rejecting unauthenticated webhook.',
      );
      throw new BadRequestException('Stripe webhook verification failed: missing webhook secret');
    }

    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const isValid = this.verifyWebhookSignature(payloadStr, signature);
    if (!isValid) {
      this.logger.error('Invalid Stripe webhook signature verification');
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    const eventType = payload?.type || 'unknown';
    const eventId = payload?.id;
    const data = payload?.data?.object;

    this.logger.log(
      `Handling verified Stripe webhook event: ${eventType} (ID: ${eventId || 'n/a'})`,
    );

    if (this.prisma && eventId) {
      const existingEvent = await this.prisma.stripeEvent.findUnique({
        where: { id: eventId },
      });

      if (existingEvent?.processed) {
        this.logger.log(
          `Stripe event ${eventId} has already been processed. Skipping duplicate execution.`,
        );
        return {
          eventType,
          handled: true,
          data,
        };
      }
    }

    // Process database side-effects based on verified event type
    if (this.prisma && data) {
      try {
        switch (eventType) {
          case 'checkout.session.completed': {
            const userId = data.metadata?.userId || data.client_reference_id;
            const planSlug = data.metadata?.planSlug;
            const billingCycle = data.metadata?.billingCycle || 'monthly';

            if (userId && planSlug) {
              const plan = await this.prisma.subscriptionPlan.findUnique({
                where: { slug: planSlug },
              });

              if (plan) {
                const now = new Date();
                const periodEnd = new Date();
                if (billingCycle === 'yearly') {
                  periodEnd.setFullYear(periodEnd.getFullYear() + 1);
                } else {
                  periodEnd.setMonth(periodEnd.getMonth() + 1);
                }

                const providerSubId = data.subscription || data.id;

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
                        status: 'ACTIVE',
                        provider: 'STRIPE',
                        providerSubId,
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
                        status: 'ACTIVE',
                        provider: 'STRIPE',
                        providerSubId,
                        currentPeriodStart: now,
                        currentPeriodEnd: periodEnd,
                      },
                    });
                    subId = created.id;
                  }

                  const amount = data.amount_total
                    ? data.amount_total / 100
                    : Number(billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly);

                  await tx.invoice.create({
                    data: {
                      userId,
                      subscriptionId: subId,
                      amountTotal: amount,
                      currency: data.currency?.toUpperCase() || 'USD',
                      status: 'PAID',
                      pdfUrl: data.invoice_pdf || 'https://ai-interview.dev/invoice.pdf',
                      paidAt: now,
                    },
                  });

                  if (eventId) {
                    await tx.stripeEvent.upsert({
                      where: { id: eventId },
                      update: { processed: true },
                      create: { id: eventId, eventType, processed: true },
                    });
                  }
                });

                // Emit billing.payment_succeeded event (NEW-BILLING-01)
                const user = this.prisma?.user?.findUnique
                  ? await this.prisma.user.findUnique({
                      where: { id: userId },
                      include: { profile: true },
                    })
                  : null;
                this.eventEmitter?.emit('billing.payment_succeeded', {
                  userId,
                  email: user?.email || data.customer_email || '',
                  userName: user?.profile?.fullName || 'Valued Member',
                  planName: plan.name,
                  amount: data.amount_total
                    ? data.amount_total / 100
                    : Number(billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly),
                  currency: data.currency?.toUpperCase() || 'USD',
                  paymentMethod: 'Credit Card (Stripe)',
                  invoiceId: data.invoice || eventId || `INV-STRIPE-${Date.now()}`,
                  paidAt: now.toISOString().split('T')[0],
                });
              }
            }
            break;
          }

          case 'invoice.payment_succeeded': {
            const providerSubId = data.subscription;
            if (providerSubId) {
              const sub = await this.prisma.subscription.findFirst({
                where: { providerSubId },
                include: { plan: true },
              });

              if (sub) {
                const now = new Date();
                const periodEnd = new Date();
                periodEnd.setMonth(periodEnd.getMonth() + 1);

                await this.prisma.$transaction(async tx => {
                  await tx.subscription.update({
                    where: { id: sub.id },
                    data: { status: 'ACTIVE', currentPeriodEnd: periodEnd },
                  });

                  await tx.invoice.create({
                    data: {
                      userId: sub.userId,
                      subscriptionId: sub.id,
                      amountTotal: data.amount_paid ? data.amount_paid / 100 : 0,
                      currency: data.currency?.toUpperCase() || 'USD',
                      status: 'PAID',
                      pdfUrl: data.hosted_invoice_url || data.invoice_pdf,
                      paidAt: now,
                    },
                  });

                  if (eventId) {
                    await tx.stripeEvent.upsert({
                      where: { id: eventId },
                      update: { processed: true },
                      create: { id: eventId, eventType, processed: true },
                    });
                  }
                });

                // Emit billing.payment_succeeded event (NEW-BILLING-01)
                const user = this.prisma?.user?.findUnique
                  ? await this.prisma.user.findUnique({
                      where: { id: sub.userId },
                      include: { profile: true },
                    })
                  : null;
                this.eventEmitter?.emit('billing.payment_succeeded', {
                  userId: sub.userId,
                  email: user?.email || data.customer_email || '',
                  userName: user?.profile?.fullName || 'Valued Member',
                  planName: sub.plan?.name || 'Pro Plan',
                  amount: data.amount_paid ? data.amount_paid / 100 : 0,
                  currency: data.currency?.toUpperCase() || 'USD',
                  paymentMethod: 'Credit Card (Stripe)',
                  invoiceId: data.id || `INV-STRIPE-${Date.now()}`,
                  paidAt: now.toISOString().split('T')[0],
                });
              }
            }
            break;
          }

          case 'invoice.payment_failed': {
            const providerSubId = data.subscription;
            if (providerSubId) {
              await this.prisma.subscription.updateMany({
                where: { providerSubId },
                data: { status: 'PAST_DUE' },
              });
            }
            break;
          }

          case 'customer.subscription.deleted': {
            const providerSubId = data.id;
            if (providerSubId) {
              await this.prisma.subscription.updateMany({
                where: { providerSubId },
                data: { status: 'CANCELED', canceledAt: new Date() },
              });
            }
            break;
          }
        }
      } catch (dbErr: any) {
        this.logger.error(
          `Error processing webhook state transition: ${dbErr.message}`,
          dbErr.stack,
        );
      }
    }

    return {
      eventType,
      handled: true,
      data,
    };
  }
}
