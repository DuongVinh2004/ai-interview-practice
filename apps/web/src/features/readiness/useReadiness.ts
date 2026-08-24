import { useQuery } from '@tanstack/react-query';
import {
  ReadinessDashboardResponseDto,
  ReadinessHistoryResponseDto,
  ReadinessRoleCompareItemDto,
} from '@ai-interview/contracts';
import { apiClient } from '../../lib/api-client';

export function useReadiness(role: string = 'backend') {
  const dashboardQuery = useQuery<ReadinessDashboardResponseDto>({
    queryKey: ['readiness', 'dashboard', role],
    queryFn: () => apiClient<ReadinessDashboardResponseDto>(`/profile/readiness?role=${encodeURIComponent(role)}`),
  });

  const useHistory = (period: '30d' | '90d' | '180d' | '365d' = '30d') =>
    useQuery<ReadinessHistoryResponseDto>({
      queryKey: ['readiness', 'history', period],
      queryFn: () => apiClient<ReadinessHistoryResponseDto>(`/profile/readiness/history?period=${period}`),
    });

  const compareQuery = useQuery<ReadinessRoleCompareItemDto[]>({
    queryKey: ['readiness', 'compare'],
    queryFn: () => apiClient<ReadinessRoleCompareItemDto[]>('/profile/readiness/compare'),
  });

  return {
    dashboard: dashboardQuery.data,
    isLoading: dashboardQuery.isLoading,
    error: dashboardQuery.error,
    refetch: dashboardQuery.refetch,
    useHistory,
    compareData: compareQuery.data || [],
    isLoadingCompare: compareQuery.isLoading,
  };
}
