import { Injectable } from '@nestjs/common';
import { BillingProvider } from '../interfaces/billing-provider.interface';
import { CreateCheckoutRequest, CheckoutResponse } from '@ai-interview/contracts';

@Injectable()
export class MockBillingProvider implements BillingProvider {
  readonly name = 'mock';

  async createCheckoutSession(
    userId: string,
    userEmail: string,
    req: CreateCheckoutRequest,
    _stripePriceId?: string,
  ): Promise<CheckoutResponse> {
    const mockSessionId = `mock_checkout_sess_${Date.now()}`;
    const baseSuccessUrl = req.successUrl || 'https://ai-interview.dev/billing/success';
    const redirectUrl = `${baseSuccessUrl}?session_id=${mockSessionId}&mock=true`;

    return {
      checkoutUrl: redirectUrl,
      sessionId: mockSessionId,
    };
  }

  async createCustomerPortalSession(
    _customerId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    return {
      url: `${returnUrl}?portal=mock_success`,
    };
  }

  async handleWebhook(
    payload: any,
    _signature?: string,
    _rawBody?: string,
  ): Promise<{ eventType: string; handled: boolean; data?: any }> {
    return {
      eventType: payload?.type || 'mock.event',
      handled: true,
      data: payload,
    };
  }
}
