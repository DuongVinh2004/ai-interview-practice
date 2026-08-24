import {
  CreateCheckoutRequest,
  CheckoutResponse,
} from '@ai-interview/contracts';

export interface BillingProvider {
  readonly name: string;
  createCheckoutSession(
    userId: string,
    userEmail: string,
    req: CreateCheckoutRequest,
  ): Promise<CheckoutResponse>;

  createCustomerPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<{ url: string }>;

  handleWebhook(
    payload: any,
    signature?: string,
  ): Promise<{ eventType: string; handled: boolean; data?: any }>;
}
