import { useEffect, useState, useRef, useCallback } from 'react';
import { SseEventType } from '@ai-interview/contracts';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../stores/auth.store';

interface UseInterviewSseOptions {
  sessionId?: string;
  enabled?: boolean;
  onEvent?: (eventType: SseEventType, data: any) => void;
  onSessionUpdated?: () => void;
}

const SSE_RECONNECT_DELAY_MS = 1000;
const SSE_MAX_RECONNECT_ATTEMPTS = 3;

/**
 * Secure SSE hook for realtime interview feedback.
 * Authenticates via standard `Authorization: Bearer <token>` headers instead of
 * URL query parameters (?token=...) to avoid token leakage in server/proxy access logs (NEW-SEC-03).
 */
export function useInterviewSse({
  sessionId,
  enabled = true,
  onEvent,
  onSessionUpdated,
}: UseInterviewSseOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [usingFallbackPolling, setUsingFallbackPolling] = useState(false);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const onEventRef = useRef(onEvent);
  const onSessionUpdatedRef = useRef(onSessionUpdated);

  useEffect(() => {
    onEventRef.current = onEvent;
    onSessionUpdatedRef.current = onSessionUpdated;
  });

  const pollStatus = useCallback(async () => {
    if (!sessionId) return;
    try {
      await apiClient(`/interviews/${sessionId}/status`);
      onSessionUpdatedRef.current?.();
    } catch (err) {
      console.warn('Polling status error:', err);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !enabled) {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const sseUrl = `${API_BASE}/interviews/${sessionId}/events`;
    const abortController = new AbortController();
    let isCancelled = false;
    let reconnectAttempts = 0;

    function startPollingFallback() {
      if (isCancelled || pollingTimerRef.current) return;
      setUsingFallbackPolling(true);
      pollingTimerRef.current = setInterval(pollStatus, 3000);
    }

    function scheduleReconnect() {
      if (isCancelled) return;
      if (reconnectAttempts >= SSE_MAX_RECONNECT_ATTEMPTS) {
        startPollingFallback();
        return;
      }

      reconnectAttempts += 1;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        void startStream();
      }, SSE_RECONNECT_DELAY_MS);
    }

    async function startStream() {
      try {
        const accessToken = useAuthStore.getState().accessToken;
        const headers: Record<string, string> = {
          Accept: 'text/event-stream',
        };
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const response = await fetch(sseUrl, {
          headers,
          signal: abortController.signal,
          credentials: 'include',
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed with status ${response.status}`);
        }

        setIsConnected(true);
        setUsingFallbackPolling(false);
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!isCancelled) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const block of lines) {
            const dataLine = block.split('\n').find(l => l.startsWith('data: '));
            if (dataLine) {
              const rawJson = dataLine.slice(6).trim();
              try {
                const payload = JSON.parse(rawJson);
                if (payload.type !== SseEventType.HEARTBEAT) {
                  onEventRef.current?.(payload.type, payload.data);
                  onSessionUpdatedRef.current?.();
                }
              } catch {
                // Ping or plain text frame
              }
            }
          }
        }

        if (!isCancelled) {
          setIsConnected(false);
          scheduleReconnect();
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || isCancelled) return;
        setIsConnected(false);
        scheduleReconnect();
      }
    }

    startStream();

    return () => {
      isCancelled = true;
      abortController.abort();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId, enabled, pollStatus]);

  return { isConnected, usingFallbackPolling };
}
