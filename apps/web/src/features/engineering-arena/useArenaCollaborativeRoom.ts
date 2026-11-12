import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../../stores/auth.store';
import {
  ArenaCollaborativeRole,
  ArenaCollaborativeParticipant,
  ArenaRoomPresence,
  ArenaSharedTestBroadcast,
} from '@ai-interview/contracts';

export interface RemoteCursorInfo {
  userId: string;
  displayName: string;
  role: ArenaCollaborativeRole;
  color: string;
  file: string;
  line: number;
  column: number;
  timestamp: number;
}

export interface UseArenaCollaborativeRoomOptions {
  roomId: string;
  role?: ArenaCollaborativeRole;
  initialFiles?: Record<string, string>;
  token?: string;
}

export function useArenaCollaborativeRoom({
  roomId,
  role = ArenaCollaborativeRole.HOST,
  initialFiles = {},
  token,
}: UseArenaCollaborativeRoomOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presence, setPresence] = useState<ArenaRoomPresence | null>(null);
  const [participants, setParticipants] = useState<ArenaCollaborativeParticipant[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursorInfo>>({});
  const [activeCode, setActiveCode] = useState<Record<string, string>>(initialFiles);
  const [sharedTestRun, setSharedTestRun] = useState<ArenaSharedTestBroadcast | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const authToken = token || useAuthStore.getState().accessToken;

  useEffect(() => {
    if (!roomId) return;

    const wsBaseUrl =
      import.meta.env.VITE_WS_URL ||
      import.meta.env.VITE_API_BASE_URL?.replace(/^http/, 'ws') ||
      (typeof window !== 'undefined'
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
        : 'ws://localhost:3001');

    const socketUrl = `${wsBaseUrl}/arena-collab`;

    const socket = io(socketUrl, {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      socket.emit('arena:join-room', { roomId, role });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('arena:room-joined', (data: ArenaRoomPresence) => {
      setPresence(data);
      setParticipants(data.participants || []);
    });

    socket.on('arena:presence-sync', (data: ArenaRoomPresence) => {
      setPresence(data);
      setParticipants(data.participants || []);
    });

    socket.on(
      'arena:user-joined',
      (data: { roomId: string; participant: ArenaCollaborativeParticipant }) => {
        setParticipants(prev => {
          const filtered = prev.filter(p => p.socketId !== data.participant.socketId);
          return [...filtered, data.participant];
        });
      },
    );

    socket.on('arena:user-left', (data: { roomId: string; userId: string; socketId?: string }) => {
      setParticipants(prev =>
        prev.filter(p => p.userId !== data.userId && p.socketId !== data.socketId),
      );
      setRemoteCursors(prev => {
        const next = { ...prev };
        delete next[data.userId];
        return next;
      });
    });

    socket.on('arena:cursor-broadcast', (cursor: RemoteCursorInfo) => {
      setRemoteCursors(prev => ({
        ...prev,
        [cursor.userId]: cursor,
      }));
    });

    socket.on(
      'arena:code-broadcast',
      (data: { file: string; content: string; userId: string; version: number }) => {
        setActiveCode(prev => ({
          ...prev,
          [data.file]: data.content,
        }));
      },
    );

    socket.on('arena:test-status', (testBroadcast: ArenaSharedTestBroadcast) => {
      setSharedTestRun(testBroadcast);
    });

    socket.on('arena:error', (err: { code: string; message: string }) => {
      setError(err);
    });

    return () => {
      socket.emit('arena:leave-room', { roomId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, role, authToken]);

  const sendCursorMove = useCallback(
    (file: string, line: number, column: number) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('arena:cursor-move', {
          roomId,
          file,
          line,
          column,
        });
      }
    },
    [roomId],
  );

  const sendCodeChange = useCallback(
    (file: string, content: string, patch?: string) => {
      setActiveCode(prev => ({
        ...prev,
        [file]: content,
      }));
      if (socketRef.current?.connected) {
        socketRef.current.emit('arena:code-change', {
          roomId,
          file,
          content,
          patch,
        });
      }
    },
    [roomId],
  );

  const sendRunTests = useCallback(
    (data: Partial<ArenaSharedTestBroadcast>) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('arena:run-tests', {
          roomId,
          commandId: data.commandId || 'test',
          status: data.status,
          stdout: data.stdout || '',
          stderr: data.stderr || '',
          durationMs: data.durationMs || 0,
          testsTotal: data.testsTotal || 0,
          testsPassed: data.testsPassed || 0,
          testsFailed: data.testsFailed || 0,
          testResults: data.testResults || [],
        });
      }
    },
    [roomId],
  );

  const leaveRoom = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('arena:leave-room', { roomId });
    }
  }, [roomId]);

  return {
    isConnected,
    presence,
    participants,
    remoteCursors,
    activeCode,
    sharedTestRun,
    error,
    sendCursorMove,
    sendCodeChange,
    sendRunTests,
    leaveRoom,
  };
}
