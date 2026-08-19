import { useEffect, useState, useRef, useCallback } from 'react';
import { SseEventType } from '@ai-interview/contracts';
import { apiClient } from '../lib/api-client';

interface UseInterviewSseOptions {
  sessionId?: string;
  enabled?: boolean;
  onEvent?: (eventType: SseEventType, data: any) => void;
  onSessionUpdated?: () => void;
}

export function useInterviewSse({
  sessionId,
  enabled = true,
  onEvent,
  onSessionUpdated,
}: UseInterviewSseOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [usingFallbackPolling, setUsingFallbackPolling] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const pollStatus = useCallback(async () => {
    if (!sessionId) return;
    try {
      await apiClient(`/interviews/${sessionId}/status`);
      onSessionUpdated?.();
    } catch (err) {
      console.warn('Polling status error:', err);
    }
  }, [sessionId, onSessionUpdated]);

  useEffect(() => {
    if (!sessionId || !enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const sseUrl = `${API_BASE}/interviews/${sessionId}/events`;

    try {
      const eventSource = new EventSource(sseUrl, { withCredentials: true });
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setUsingFallbackPolling(false);
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
      };

      eventSource.onmessage = event => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type !== SseEventType.HEARTBEAT) {
            onEvent?.(payload.type, payload.data);
            onSessionUpdated?.();
          }
        } catch {
          // non-json or ping
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        setUsingFallbackPolling(true);
        eventSource.close();

        // Start fallback polling if not already started
        if (!pollingTimerRef.current) {
          pollingTimerRef.current = setInterval(pollStatus, 3000);
        }
      };
    } catch {
      setUsingFallbackPolling(true);
      if (!pollingTimerRef.current) {
        pollingTimerRef.current = setInterval(pollStatus, 3000);
      }
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId, enabled, onEvent, onSessionUpdated, pollStatus]);

  return { isConnected, usingFallbackPolling };
}
