import { useQuery } from '@tanstack/react-query';
import {
  SkillGraphResponseDto,
  BenchmarkRankingDto,
  SkillProgressTrendDto,
  GapAnalysisResponseDto,
} from '@ai-interview/contracts';
import { apiClient } from '../../lib/api-client';

export function useSkillGraph() {
  const graphQuery = useQuery<SkillGraphResponseDto>({
    queryKey: ['skills', 'graph'],
    queryFn: () => apiClient<SkillGraphResponseDto>('/profile/skills/graph'),
  });

  const useBenchmark = (role = 'backend', level = 'senior') =>
    useQuery<BenchmarkRankingDto>({
      queryKey: ['skills', 'benchmark', role, level],
      queryFn: () =>
        apiClient<BenchmarkRankingDto>(`/profile/skills/benchmark?role=${encodeURIComponent(role)}&level=${encodeURIComponent(level)}`),
    });

  const useProgress = (period: '7d' | '30d' | '90d' | '180d' | '365d' = '30d') =>
    useQuery<SkillProgressTrendDto>({
      queryKey: ['skills', 'progress', period],
      queryFn: () =>
        apiClient<SkillProgressTrendDto>(`/profile/skills/progress?period=${period}`),
    });

  const gapsQuery = useQuery<GapAnalysisResponseDto>({
    queryKey: ['skills', 'gaps'],
    queryFn: () => apiClient<GapAnalysisResponseDto>('/profile/skills/gaps'),
  });

  return {
    graph: graphQuery.data,
    isLoadingGraph: graphQuery.isLoading,
    graphError: graphQuery.error,
    refetchGraph: graphQuery.refetch,
    useBenchmark,
    useProgress,
    gaps: gapsQuery.data,
    isLoadingGaps: gapsQuery.isLoading,
  };
}
