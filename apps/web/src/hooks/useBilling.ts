import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import {
  SubscriptionPlanDto,
  SubscriptionResponse,
  UsageSummary,
  InvoiceDto,
  CreateCheckoutRequest,
  CheckoutResponse,
} from '@ai-interview/contracts';

export function useBilling() {
  const queryClient = useQueryClient();

  const plansQuery = useQuery<SubscriptionPlanDto[]>({
    queryKey: ['billing', 'plans'],
    queryFn: () => apiClient<SubscriptionPlanDto[]>('/billing/plans'),
  });

  const subscriptionQuery = useQuery<SubscriptionResponse>({
    queryKey: ['billing', 'subscription'],
    queryFn: () => apiClient<SubscriptionResponse>('/billing/subscription'),
  });

  const usageQuery = useQuery<UsageSummary>({
    queryKey: ['billing', 'usage'],
    queryFn: () => apiClient<UsageSummary>('/billing/usage'),
  });

  const invoicesQuery = useQuery<InvoiceDto[]>({
    queryKey: ['billing', 'invoices'],
    queryFn: () => apiClient<InvoiceDto[]>('/billing/invoices'),
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

  return {
    plans: plansQuery.data || [],
    isLoadingPlans: plansQuery.isLoading,
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
