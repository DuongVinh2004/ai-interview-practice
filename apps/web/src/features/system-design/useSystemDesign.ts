import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  SystemDesignSessionDto,
  CanvasSnapshotDto,
  VisionAnalysisResultDto,
  DesignEvaluationDto,
} from '@ai-interview/contracts';
import { apiClient } from '../../lib/api-client';

export function useSystemDesign(interviewId: string) {
  const queryClient = useQueryClient();
  const [activeSnapshotIdx, setActiveSnapshotIdx] = useState<number | null>(null);

  // Initialize or fetch whiteboard session
  const sessionQuery = useQuery<SystemDesignSessionDto>({
    queryKey: ['system-design', interviewId],
    queryFn: () =>
      apiClient<SystemDesignSessionDto>(`/interviews/${interviewId}/canvas/init`, {
        method: 'POST',
      }),
    enabled: !!interviewId,
  });

  // Fetch snapshot history
  const historyQuery = useQuery<CanvasSnapshotDto[]>({
    queryKey: ['system-design', interviewId, 'history'],
    queryFn: () => apiClient<CanvasSnapshotDto[]>(`/interviews/${interviewId}/canvas/history`),
    enabled: !!interviewId,
  });

  // Mutation to save snapshot
  const saveSnapshotMutation = useMutation<
    CanvasSnapshotDto,
    Error,
    { imageUrl: string; canvasStateJson?: any; elapsedSeconds?: number }
  >({
    mutationFn: body =>
      apiClient<CanvasSnapshotDto>(`/interviews/${interviewId}/canvas/snapshot`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-design', interviewId, 'history'] });
    },
  });

  // Mutation to analyze snapshot
  const analyzeMutation = useMutation<
    VisionAnalysisResultDto,
    Error,
    { imageUrl?: string; canvasStateJson?: any }
  >({
    mutationFn: body =>
      apiClient<VisionAnalysisResultDto>(`/interviews/${interviewId}/canvas/analyze`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });

  // Mutation to evaluate design
  const evaluateMutation = useMutation<DesignEvaluationDto, Error, void>({
    mutationFn: () =>
      apiClient<DesignEvaluationDto>(`/interviews/${interviewId}/canvas/evaluate`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-design', interviewId] });
    },
  });

  return {
    session: sessionQuery.data,
    isLoadingSession: sessionQuery.isLoading,
    snapshots: historyQuery.data || [],
    isLoadingHistory: historyQuery.isLoading,
    activeSnapshotIdx,
    setActiveSnapshotIdx,
    saveSnapshot: saveSnapshotMutation.mutateAsync,
    isSavingSnapshot: saveSnapshotMutation.isPending,
    analyzeCanvas: analyzeMutation.mutateAsync,
    isAnalyzing: analyzeMutation.isPending,
    analysisResult: analyzeMutation.data,
    evaluateDesign: evaluateMutation.mutateAsync,
    isEvaluating: evaluateMutation.isPending,
    evaluation: evaluateMutation.data || sessionQuery.data?.evaluation,
  };
}
