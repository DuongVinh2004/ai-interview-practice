import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import {
  TutorSessionDto,
  QuestionRetryRequest,
  QuestionRetryResponse,
  TutorRatingRequest,
} from '@ai-interview/contracts';

export function useTutor() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');

  // 1. Fetch or create session
  const createSessionMutation = useMutation({
    mutationFn: async (vars: { interviewId: string; turnNumber: number }) => {
      const res = await apiClient.post<TutorSessionDto>('/tutor/sessions', vars);
      setActiveSessionId(res.data.id);
      return res.data;
    },
  });

  // 2. Fetch session history
  const { data: session, isLoading: isLoadingSession, refetch: refetchSession } = useQuery({
    queryKey: ['tutor', 'session', activeSessionId],
    queryFn: async () => {
      if (!activeSessionId) return null;
      const res = await apiClient.get<TutorSessionDto>(`/tutor/sessions/${activeSessionId}`);
      return res.data;
    },
    enabled: !!activeSessionId,
  });

  // 3. Send message with SSE streaming
  const sendMessage = async (messageText: string) => {
    if (!activeSessionId) return;

    setIsStreaming(true);
    setStreamedContent('');

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/tutor/sessions/${activeSessionId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: messageText }),
      });

      if (!response.ok) {
        throw new Error('Failed to stream tutor response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (reader) {
        let accumulated = '';
        let isDone = false;
        while (!isDone) {
          const { done, value } = await reader.read();
          if (done) {
            isDone = true;
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

          for (const line of lines) {
            const jsonStr = line.replace('data: ', '').trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === 'token') {
                accumulated += parsed.content;
                setStreamedContent(accumulated);
              } else if (parsed.type === 'done') {
                // finished
              }
            } catch (e) {
              // ignore parse errors on partial frames
            }
          }
        }
      }

      await refetchSession();
    } finally {
      setIsStreaming(false);
      setStreamedContent('');
    }
  };

  // 4. Submit retry
  const submitRetryMutation = useMutation({
    mutationFn: async (payload: QuestionRetryRequest) => {
      const res = await apiClient.post<QuestionRetryResponse>('/tutor/retry', payload);
      return res.data;
    },
  });

  // 5. Rate tutor
  const rateTutorMutation = useMutation({
    mutationFn: async (vars: { sessionId: string; rating: TutorRatingRequest }) => {
      const res = await apiClient.post(`/tutor/sessions/${vars.sessionId}/rate`, vars.rating);
      return res.data;
    },
  });

  return {
    session,
    activeSessionId,
    setActiveSessionId,
    isLoadingSession,
    createSession: createSessionMutation.mutateAsync,
    isCreatingSession: createSessionMutation.isPending,
    sendMessage,
    isStreaming,
    streamedContent,
    submitRetry: submitRetryMutation.mutateAsync,
    isSubmittingRetry: submitRetryMutation.isPending,
    rateTutor: rateTutorMutation.mutateAsync,
  };
}
