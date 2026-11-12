import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '../../stores/auth.store';

export interface StreamLogEntry {
  type: 'stdout' | 'stderr' | 'status' | 'test_result' | 'heartbeat';
  payload: string;
  timestamp: string;
}

export function useArenaExecutionStream(sessionId: string | null) {
  const [logs, setLogs] = useState<StreamLogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setIsConnected(false);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let isCancelled = false;

    async function connectStream() {
      try {
        const token = useAuthStore.getState().accessToken;
        const headers: Record<string, string> = {
          Accept: 'text/event-stream',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
        const url = `${API_BASE}/arena/sessions/${sessionId}/stream`;

        const fetchOptions: RequestInit = {
          headers,
        };
        if (typeof AbortSignal !== 'undefined' && abortController?.signal instanceof AbortSignal) {
          fetchOptions.signal = abortController.signal;
        }

        const response = await fetch(url, fetchOptions);

        if (!response.ok || !response.body) {
          throw new Error(`SSE HTTP error ${response.status}`);
        }

        setIsConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!isCancelled) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              try {
                const dataJson = trimmed.slice(5).trim();
                if (dataJson) {
                  const parsed = JSON.parse(dataJson) as StreamLogEntry;
                  if (parsed && parsed.payload && parsed.type !== 'heartbeat') {
                    setLogs(prev => [...prev, parsed]);
                  }
                }
              } catch (e) {
                // Ignore parse error on partial chunks
              }
            }
          }
        }
      } catch (err: any) {
        if (!isCancelled && err.name !== 'AbortError') {
          console.warn('Arena SSE stream disconnected:', err.message);
          setIsConnected(false);
        }
      } finally {
        if (!isCancelled) {
          setIsConnected(false);
        }
      }
    }

    void connectStream();

    return () => {
      isCancelled = true;
      abortController.abort();
      setIsConnected(false);
    };
  }, [sessionId]);

  return {
    logs,
    isConnected,
    clearLogs,
  };
}
