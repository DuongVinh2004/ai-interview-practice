import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingProvider } from '../interfaces/billing-provider.interface';
import {
  CreateCheckoutRequest,
  CheckoutResponse,
} from '@ai-interview/contracts';

@Injectable()
export class StripeProvider implements BillingProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripeProvider.name);
  private readonly apiKey: string;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('STRIPE_SECRET_KEY', '');
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET', '');
  }

  async createCheckoutSession(
    userId: string,
    userEmail: string,
    req: CreateCheckoutRequest,
  ): Promise<CheckoutResponse> {
    const successUrl = req.successUrl || 'https://ai-interview.dev/billing/success';
    const cancelUrl = req.cancelUrl || 'https://ai-interview.dev/billing';

    if (!this.apiKey) {
      this.logger.warn('Stripe API Key missing. Falling back to mock checkout session.');
      const mockSessionId = `mock_stripe_${Date.now()}`;
      return {
        checkoutUrl: `${successUrl}?session_id=${mockSessionId}`,
        sessionId: mockSessionId,
      };
    }

    try {
      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          mode: 'subscription',
          customer_email: userEmail,
          'metadata[userId]': userId,
          'metadata[planSlug]': req.planSlug,
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      });

      const session = (await response.json()) as any;
      return {
        checkoutUrl: session.url || `${successUrl}?session_id=${session.id}`,
        sessionId: session.id,
      };
    } catch (err: any) {
      this.logger.error(`Stripe checkout creation failed: ${err.message}`);
      return {
        checkoutUrl: cancelUrl,
        sessionId: 'error_session',
      };
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

      const portal = (await response.json()) as any;
      return { url: portal.url || returnUrl };
    } catch (err: any) {
      this.logger.error(`Stripe portal session failed: ${err.message}`);
      return { url: returnUrl };
    }
  }

  async handleWebhook(
    payload: any,
    _signature?: string,
  ): Promise<{ eventType: string; handled: boolean; data?: any }> {
    const eventType = payload?.type || 'unknown';
    this.logger.log(`Handling Stripe webhook event: ${eventType}`);
    return {
      eventType,
      handled: true,
      data: payload?.data?.object,
    };
  }
}
