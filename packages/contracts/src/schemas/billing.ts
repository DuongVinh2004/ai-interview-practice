import { z } from 'zod';
import { SubscriptionStatus, InvoiceStatus, BillingMetric } from '../enums';

export const BillingMetricSchema = z.nativeEnum(BillingMetric);
export type BillingMetricType = z.infer<typeof BillingMetricSchema>;

export const SubscriptionPlanSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(), // "free", "pro", "team", "enterprise"
  name: z.string(),
  nameVi: z.string(),
  description: z.string().nullable().optional(),
  priceMonthly: z.number().min(0),
  priceYearly: z.number().min(0),
  currency: z.string().default('USD'),
  features: z.array(z.string()),
  limits: z.object({
    sessionsPerMonth: z.number().int(),
    voiceMinutesPerMonth: z.number().int(),
    allowLiveCoding: z.boolean(),
    allowSystemDesign: z.boolean(),
    mentorFeedbackLimit: z.number().int(),
  }),
  stripePriceIdMonthly: z.string().nullable().optional(),
  stripePriceIdYearly: z.string().nullable().optional(),
  isActive: z.boolean(),
});
export type SubscriptionPlanDto = z.infer<typeof SubscriptionPlanSchema>;

export const CreateCheckoutRequestSchema = z.object({
  planSlug: z.string(),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
export type CreateCheckoutRequest = z.infer<typeof CreateCheckoutRequestSchema>;

export const CheckoutResponseSchema = z.object({
  checkoutUrl: z.string(),
  sessionId: z.string(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;

export const SubscriptionResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  plan: SubscriptionPlanSchema,
  status: z.nativeEnum(SubscriptionStatus),
  provider: z.string(),
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime(),
  cancelAtPeriodEnd: z.boolean().default(false),
  canceledAt: z.string().datetime().nullable().optional(),
});
export type SubscriptionResponse = z.infer<typeof SubscriptionResponseSchema>;

export const UsageSummarySchema = z.object({
  sessionsUsed: z.number().int().default(0),
  sessionsLimit: z.number().int().default(5),
  voiceMinutesUsed: z.number().default(0),
  voiceMinutesLimit: z.number().default(0),
  aiTokensUsed: z.number().int().default(0),
  billingPeriodStart: z.string().datetime(),
  billingPeriodEnd: z.string().datetime(),
  planSlug: z.string(),
  isQuotaExceeded: z.boolean().default(false),
});
export type UsageSummary = z.infer<typeof UsageSummarySchema>;

export const InvoiceDtoSchema = z.object({
  id: z.string().uuid(),
  subscriptionId: z.string().uuid().nullable().optional(),
  amountTotal: z.number(),
  currency: z.string(),
  status: z.nativeEnum(InvoiceStatus),
  stripeInvoiceId: z.string().nullable().optional(),
  pdfUrl: z.string().nullable().optional(),
  issuedAt: z.string().datetime(),
  paidAt: z.string().datetime().nullable().optional(),
});
export type InvoiceDto = z.infer<typeof InvoiceDtoSchema>;

export const CreatePayosPaymentSchema = z.object({
  planSlug: z.string(),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
export type CreatePayosPaymentDto = z.infer<typeof CreatePayosPaymentSchema>;

export const PayosPaymentResponseSchema = z.object({
  orderCode: z.number(),
  checkoutUrl: z.string(),
  qrCode: z.string(),
  amount: z.number(),
  currency: z.string().default('VND'),
  status: z.string().default('PENDING'),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
  bin: z.string().optional(),
  description: z.string().optional(),
});
export type PayosPaymentResponseDto = z.infer<typeof PayosPaymentResponseSchema>;

export const PayosWebhookSchema = z.object({
  code: z.string().or(z.number()),
  desc: z.string(),
  success: z.boolean().optional(),
  data: z.object({
    orderCode: z.number(),
    amount: z.number(),
    description: z.string(),
    accountNumber: z.string().optional(),
    reference: z.string().optional(),
    transactionDateTime: z.string().optional(),
    currency: z.string().optional(),
    paymentLinkId: z.string().optional(),
    code: z.string().optional(),
    desc: z.string().optional(),
    counterAccountBankId: z.string().nullable().optional(),
    counterAccountBankName: z.string().nullable().optional(),
    counterAccountName: z.string().nullable().optional(),
    counterAccountNumber: z.string().nullable().optional(),
    virtualAccountName: z.string().nullable().optional(),
    virtualAccountNumber: z.string().nullable().optional(),
  }),
  signature: z.string(),
});
export type PayosWebhookDto = z.infer<typeof PayosWebhookSchema>;

