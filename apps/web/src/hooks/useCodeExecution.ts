import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import {
  ExecuteCodeRequest,
  ExecuteCodeResponse,
  SubmitCodeRequest,
  CodeSubmissionResponse,
} from '@ai-interview/contracts';

export function useCodeExecution(sessionId: string) {
  const queryClient = useQueryClient();

  const executeMutation = useMutation<ExecuteCodeResponse, Error, ExecuteCodeRequest>({
    mutationFn: async payload => {
      return apiClient<ExecuteCodeResponse>(`/interviews/${sessionId}/code/execute`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  });

  const submitMutation = useMutation<CodeSubmissionResponse, Error, SubmitCodeRequest>({
    mutationFn: async payload => {
      return apiClient<CodeSubmissionResponse>(`/interviews/${sessionId}/code/submit`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['code-submissions', sessionId] });
    },
  });

  const submissionsQuery = useQuery<CodeSubmissionResponse[]>({
    queryKey: ['code-submissions', sessionId],
    queryFn: async () => {
      return apiClient<CodeSubmissionResponse[]>(`/interviews/${sessionId}/code/submissions`);
    },
    enabled: !!sessionId,
  });

  return {
    executeCode: executeMutation.mutateAsync,
    isExecuting: executeMutation.isPending,
    executionResult: executeMutation.data || null,
    submitCode: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    submissionResult: submitMutation.data || null,
    submissions: submissionsQuery.data || [],
    isLoadingSubmissions: submissionsQuery.isLoading,
  };
}
