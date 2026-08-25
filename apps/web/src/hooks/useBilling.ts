import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../stores/auth.store';
import {
  SubscriptionPlanDto,
  SubscriptionResponse,
  UsageSummary,
  InvoiceDto,
  CreateCheckoutRequest,
  CheckoutResponse,
} from '@ai-interview/contracts';

const DEFAULT_PLANS: SubscriptionPlanDto[] = [
  {
    id: 'plan-free',
    slug: 'free',
    name: 'Free Tier',
    nameVi: 'Gói Miễn Phí',
    description: 'Essential practice for developers starting interview prep.',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    features: [
      '5 interview sessions / month',
      'Standard AI feedback',
      'Live coding sandbox',
      'Community access',
    ],
    limits: {
      sessionsPerMonth: 5,
      voiceMinutesPerMonth: 0,
      allowLiveCoding: true,
      allowSystemDesign: false,
      mentorFeedbackLimit: 1,
    },
    isActive: true,
  },
  {
    id: 'plan-pro',
    slug: 'pro',
    name: 'Pro Tier',
    nameVi: 'Gói Chuyên Nghiệp',
    description: 'Comprehensive practice for active job seekers targeting top tech companies.',
    priceMonthly: 9.99,
    priceYearly: 99.99,
    currency: 'USD',
    features: [
      '50 interview sessions / month',
      '60 voice streaming minutes / month',
      'Live coding + System design whiteboard',
      'Detailed STAR behavioral assessment',
      '10 mentor share review links',
    ],
    limits: {
      sessionsPerMonth: 50,
      voiceMinutesPerMonth: 60,
      allowLiveCoding: true,
      allowSystemDesign: true,
      mentorFeedbackLimit: 10,
    },
    isActive: true,
  },
  {
    id: 'plan-team',
    slug: 'team',
    name: 'Team & University',
    nameVi: 'Gói Nhóm & Trường Học',
    description: 'For bootcamps, universities, and engineering teams training candidates.',
    priceMonthly: 29.99,
    priceYearly: 299.99,
    currency: 'USD',
    features: [
      '500 interview sessions / month',
      '300 voice minutes / month',
      'All interview modes (Coding, Behavioral, System Design)',
      'Unlimited mentor reviews and analytics',
    ],
    limits: {
      sessionsPerMonth: 500,
      voiceMinutesPerMonth: 300,
      allowLiveCoding: true,
      allowSystemDesign: true,
      mentorFeedbackLimit: 100,
    },
    isActive: true,
  },
  {
    id: 'plan-enterprise',
    slug: 'enterprise',
    name: 'Enterprise Tier',
    nameVi: 'Gói Doanh Nghiệp',
    description: 'Custom solutions for high-volume hiring and enterprise assessment.',
    priceMonthly: 99.99,
    priceYearly: 999.99,
    currency: 'USD',
    features: [
      'Unlimited interview sessions',
      'Unlimited voice minutes',
      'Custom rubrics & SLA guarantee (99.9%)',
      'Dedicated account manager',
    ],
    limits: {
      sessionsPerMonth: 99999,
      voiceMinutesPerMonth: 99999,
      allowLiveCoding: true,
      allowSystemDesign: true,
      mentorFeedbackLimit: 9999,
    },
    isActive: true,
  },
];

export function useBilling() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  const plansQuery = useQuery<SubscriptionPlanDto[]>({
    queryKey: ['billing', 'plans'],
    queryFn: async () => {
      try {
        const res = await apiClient<SubscriptionPlanDto[]>('/billing/plans', { skipAuth: true });
        if (Array.isArray(res) && res.length > 0) return res;
        return DEFAULT_PLANS;
      } catch {
        return DEFAULT_PLANS;
      }
    },
  });

  const subscriptionQuery = useQuery<SubscriptionResponse>({
    queryKey: ['billing', 'subscription'],
    queryFn: () => apiClient<SubscriptionResponse>('/billing/subscription'),
    enabled: isAuthenticated,
  });

  const usageQuery = useQuery<UsageSummary>({
    queryKey: ['billing', 'usage'],
    queryFn: () => apiClient<UsageSummary>('/billing/usage'),
    enabled: isAuthenticated,
  });

  const invoicesQuery = useQuery<InvoiceDto[]>({
    queryKey: ['billing', 'invoices'],
    queryFn: () => apiClient<InvoiceDto[]>('/billing/invoices'),
    enabled: isAuthenticated,
  });

  const checkoutMutation = useMutation<CheckoutResponse, Error, CreateCheckoutRequest>({
    mutationFn: (data: CreateCheckoutRequest) =>
      apiClient<CheckoutResponse>('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });

  const cancelMutation = useMutation<SubscriptionResponse, Error, void>({
    mutationFn: () =>
      apiClient<SubscriptionResponse>('/billing/cancel', {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    },
  });

  const fetchedPlans = plansQuery.data;
  const plans = fetchedPlans && fetchedPlans.length > 0 ? fetchedPlans : DEFAULT_PLANS;

  return {
    plans,
    isLoadingPlans: plansQuery.isLoading && !plansQuery.data,
    subscription: subscriptionQuery.data || null,
    isLoadingSubscription: subscriptionQuery.isLoading,
    usage: usageQuery.data || null,
    isLoadingUsage: usageQuery.isLoading,
    invoices: invoicesQuery.data || [],
    isLoadingInvoices: invoicesQuery.isLoading,
    createCheckout: checkoutMutation.mutateAsync,
    isCreatingCheckout: checkoutMutation.isPending,
    cancelSubscription: cancelMutation.mutateAsync,
    isCancelingSubscription: cancelMutation.isPending,
  };
}
