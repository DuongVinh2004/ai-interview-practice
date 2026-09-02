import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../platform/prisma/prisma.service';
import * as crypto from 'crypto';
import { BillingProvider } from '../interfaces/billing-provider.interface';
import { CreateCheckoutRequest, CheckoutResponse } from '@ai-interview/contracts';

class StripeEventAlreadyClaimedError extends Error {
  constructor() {
    super('Stripe event has already been claimed');
    this.name = 'StripeEventAlreadyClaimedError';
  }
}

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
        'metadata[billingCycle]': req.billingCycle || 'monthly',
        'subscription_data[metadata][planSlug]': req.planSlug,
        'subscription_data[metadata][billingCycle]': req.billingCycle || 'monthly',
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
    payload: unknown,
    signature?: string,
    rawBody?: string,
  ): Promise<{ eventType: string; handled: boolean; data?: unknown }> {
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

    const event = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<
      string,
      any
    >;
    const eventType = (event.type as string) || 'unknown';
    const eventId = event.id as string | undefined;
    const data = event.data?.object;

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

    // Claim and process the event in one transaction. A unique conflict on the
    // claim is the concurrent-delivery signal; every other persistence failure
    // must escape so Stripe retries the event after the transaction rolls back.
    if (this.prisma && (data || eventId)) {
      try {
        const checkoutUserId = data?.metadata?.userId || data?.client_reference_id;
        const checkoutPlanSlug = data?.metadata?.planSlug;
        const checkoutBillingCycle = this.billingCycleFor(data);
        const checkoutPlan =
          eventType === 'checkout.session.completed' && checkoutPlanSlug
            ? await this.prisma.subscriptionPlan.findUnique({
                where: { slug: checkoutPlanSlug },
              })
            : null;

        const providerSubId = data?.subscription;
        const renewalSubscription =
          eventType === 'invoice.payment_succeeded' && providerSubId
            ? await this.prisma.subscription.findFirst({
                where: { providerSubId },
                include: { plan: true },
              })
            : null;

        let paymentNotification:
          | {
              userId: string;
              planName: string;
              amount: number;
              currency: string;
              invoiceId: string;
              paidAt: string;
              customerEmail?: string;
            }
          | undefined;

        await this.prisma.$transaction(async tx => {
          if (eventId) {
            try {
              await tx.stripeEvent.create({
                data: { id: eventId, eventType, processed: false },
              });
            } catch (claimError: any) {
              if (claimError?.code === 'P2002') {
                throw new StripeEventAlreadyClaimedError();
              }
              throw claimError;
            }
          }

          switch (eventType) {
            case 'checkout.session.completed': {
              if (checkoutUserId && checkoutPlan) {
                const now = new Date();
                const periodEnd = this.periodEndFor(data, now, checkoutBillingCycle);
                const checkoutProviderSubId = data.subscription || data.id;

                const existingSub = await tx.subscription.findFirst({
                  where: { userId: checkoutUserId },
                });

                let subId = existingSub?.id;
                if (existingSub) {
                  await tx.subscription.update({
                    where: { id: existingSub.id },
                    data: {
                      planId: checkoutPlan.id,
                      status: 'ACTIVE',
                      provider: 'STRIPE',
                      providerSubId: checkoutProviderSubId,
                      currentPeriodStart: now,
                      currentPeriodEnd: periodEnd,
                      cancelAtPeriodEnd: false,
                    },
                  });
                } else {
                  const created = await tx.subscription.create({
                    data: {
                      userId: checkoutUserId,
                      planId: checkoutPlan.id,
                      status: 'ACTIVE',
                      provider: 'STRIPE',
                      providerSubId: checkoutProviderSubId,
                      currentPeriodStart: now,
                      currentPeriodEnd: periodEnd,
                    },
                  });
                  subId = created.id;
                }

                const amount = data.amount_total
                  ? data.amount_total / 100
                  : Number(
                      checkoutBillingCycle === 'yearly'
                        ? checkoutPlan.priceYearly
                        : checkoutPlan.priceMonthly,
                    );

                const checkoutInvoiceData = {
                  userId: checkoutUserId,
                  subscriptionId: subId,
                  amountTotal: amount,
                  currency: data.currency?.toUpperCase() || 'USD',
                  status: 'PAID',
                  stripeInvoiceId: data.invoice || undefined,
                  metadata: {
                    planSlug: checkoutPlan.slug,
                    billingCycle: checkoutBillingCycle,
                  },
                  pdfUrl: data.invoice_pdf || 'https://ai-interview.dev/invoice.pdf',
                  paidAt: now,
                };
                if (data.invoice) {
                  await (tx.invoice as any).upsert({
                    where: { stripeInvoiceId: data.invoice },
                    update: checkoutInvoiceData,
                    create: checkoutInvoiceData,
                  });
                } else {
                  await tx.invoice.create({ data: checkoutInvoiceData as any });
                }

                paymentNotification = {
                  userId: checkoutUserId,
                  planName: checkoutPlan.name,
                  amount,
                  currency: data.currency?.toUpperCase() || 'USD',
                  invoiceId: data.invoice || eventId || `INV-STRIPE-${Date.now()}`,
                  paidAt: now.toISOString().split('T')[0],
                  customerEmail: data.customer_email,
                };
              }
              break;
            }

            case 'invoice.payment_succeeded': {
              if (renewalSubscription) {
                const now = new Date();
                const periodEnd = this.periodEndFor(
                  data,
                  now,
                  this.billingCycleFor(data, renewalSubscription.plan),
                );

                await tx.subscription.update({
                  where: { id: renewalSubscription.id },
                  data: { status: 'ACTIVE', currentPeriodEnd: periodEnd },
                });

                const renewalInvoiceData = {
                  userId: renewalSubscription.userId,
                  subscriptionId: renewalSubscription.id,
                  amountTotal: data.amount_paid ? data.amount_paid / 100 : 0,
                  currency: data.currency?.toUpperCase() || 'USD',
                  status: 'PAID',
                  stripeInvoiceId: data.id || undefined,
                  metadata: {
                    billingCycle: this.billingCycleFor(data, renewalSubscription.plan),
                  },
                  pdfUrl: data.hosted_invoice_url || data.invoice_pdf,
                  paidAt: now,
                };
                if (data.id) {
                  await (tx.invoice as any).upsert({
                    where: { stripeInvoiceId: data.id },
                    update: renewalInvoiceData,
                    create: renewalInvoiceData,
                  });
                } else {
                  await tx.invoice.create({ data: renewalInvoiceData as any });
                }

                paymentNotification = {
                  userId: renewalSubscription.userId,
                  planName: renewalSubscription.plan?.name || 'Pro Plan',
                  amount: data.amount_paid ? data.amount_paid / 100 : 0,
                  currency: data.currency?.toUpperCase() || 'USD',
                  invoiceId: data.id || `INV-STRIPE-${Date.now()}`,
                  paidAt: now.toISOString().split('T')[0],
                  customerEmail: data.customer_email,
                };
              }
              break;
            }

            case 'invoice.payment_failed': {
              if (providerSubId) {
                await tx.subscription.updateMany({
                  where: { providerSubId },
                  data: { status: 'PAST_DUE' },
                });
              }
              break;
            }

            case 'customer.subscription.deleted': {
              const deletedProviderSubId = data.id;
              if (deletedProviderSubId) {
                await tx.subscription.updateMany({
                  where: { providerSubId: deletedProviderSubId },
                  data: { status: 'CANCELED', canceledAt: new Date() },
                });
              }
              break;
            }
          }

          if (eventId) {
            await tx.stripeEvent.update({
              where: { id: eventId },
              data: { processed: true },
            });
          }
        });

        if (paymentNotification) {
          const user = this.prisma.user?.findUnique
            ? await this.prisma.user.findUnique({
                where: { id: paymentNotification.userId },
                include: { profile: true },
              })
            : null;
          this.eventEmitter?.emit('billing.payment_succeeded', {
            userId: paymentNotification.userId,
            email: user?.email || paymentNotification.customerEmail || '',
            userName: user?.profile?.fullName || 'Valued Member',
            planName: paymentNotification.planName,
            amount: paymentNotification.amount,
            currency: paymentNotification.currency,
            paymentMethod: 'Credit Card (Stripe)',
            invoiceId: paymentNotification.invoiceId,
            paidAt: paymentNotification.paidAt,
          });
        }
      } catch (dbErr: any) {
        if (dbErr instanceof StripeEventAlreadyClaimedError) {
          this.logger.log(
            `Stripe event ${eventId} was already claimed. Skipping duplicate execution.`,
          );
          return {
            eventType,
            handled: true,
            data,
          };
        }
        this.logger.error(
          `Error processing webhook state transition: ${dbErr.message}`,
          dbErr.stack,
        );
        throw dbErr;
      }
    }

    return {
      eventType,
      handled: true,
      data,
    };
  }

  private billingCycleFor(data: any, plan?: any): 'monthly' | 'yearly' {
    const recurring =
      data?.lines?.data?.[0]?.price?.recurring ||
      data?.lines?.data?.[0]?.plan ||
      data?.price?.recurring;
    const interval = String(recurring?.interval || '').toLowerCase();
    const intervalCount = Number(recurring?.interval_count ?? recurring?.intervalCount);
    if (interval === 'year' || (interval === 'month' && intervalCount >= 12)) {
      return 'yearly';
    }

    const metadataCandidates = [
      data?.metadata,
      data?.subscription_details?.metadata,
      data?.parent?.subscription_details?.metadata,
      data?.lines?.data?.[0]?.price?.metadata,
    ];
    if (
      metadataCandidates.some(metadata =>
        ['yearly', 'annual', 'year'].includes(String(metadata?.billingCycle).toLowerCase()),
      )
    ) {
      return 'yearly';
    }

    const linePriceId = data?.lines?.data?.[0]?.price?.id;
    if (linePriceId && plan?.stripePriceIdYearly === linePriceId) {
      return 'yearly';
    }
    return 'monthly';
  }

  private periodEndFor(data: any, now: Date, billingCycle: 'monthly' | 'yearly'): Date {
    const providerPeriodEnd = Number(data?.lines?.data?.[0]?.period?.end ?? data?.period_end);
    if (Number.isFinite(providerPeriodEnd) && providerPeriodEnd > 0) {
      return new Date(providerPeriodEnd * 1000);
    }

    const periodEnd = new Date(now);
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    return periodEnd;
  }
}
