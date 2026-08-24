import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
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
        this.logger.warn(`Stripe webhook timestamp tolerance exceeded (${currentTime - eventTime}s)`);
        return false;
      }

      const signedPayload = `${timestamp}.${payloadString}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(signedPayload, 'utf8')
        .digest('hex');

      return signatures.some(sig => {
        try {
          return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSignature, 'hex'));
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
      this.logger.error('STRIPE_WEBHOOK_SECRET is not configured. Rejecting unauthenticated webhook.');
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
    this.logger.log(`Handling verified Stripe webhook event: ${eventType}`);
    return {
      eventType,
      handled: true,
      data: payload?.data?.object,
    };
  }
}
