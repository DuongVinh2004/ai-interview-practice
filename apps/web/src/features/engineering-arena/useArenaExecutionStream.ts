import { useEffect, useState, useCallback } from 'react';

export interface StreamLogEntry {
  type: 'stdout' | 'stderr' | 'status' | 'test_result';
  payload: string;
  timestamp: string;
}

export function useArenaExecutionStream(sessionId: string | null) {
  const [logs, setLogs] = useState<StreamLogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setIsConnected(false);
      return;
    }

    const eventSource = new EventSource(`/api/v1/arena/sessions/${sessionId}/stream`);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = event => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed && parsed.payload) {
          setLogs(prev => [...prev, parsed]);
        }
      } catch (err) {
        console.error('Failed to parse SSE Arena stream message:', err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [sessionId]);

  return {
    logs,
    isConnected,
    clearLogs,
  };
}
