import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStreaming } from './useVoiceStreaming';
import { apiClient } from '../lib/api-client';
import { VoiceEventType } from '@ai-interview/contracts';

vi.mock('../lib/api-client', () => ({ apiClient: { post: vi.fn() } }));

class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static sockets: FakeSocket[] = [];
  readyState = 0;
  onopen: any;
  onclose: any;
  onerror: any;
  onmessage: any;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.();
  });
  constructor(public url: string) {
    FakeSocket.sockets.push(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  message(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe('Voice connection recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.sockets = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.mocked(apiClient.post)
      .mockReset()
      .mockResolvedValue({ data: { ticket: 'valid-ticket' } });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it('reconnects with a fresh ticket after unexpected close', async () => {
    const { result, unmount } = renderHook(() => useVoiceStreaming('interview'));
    await act(async () => {
      await result.current.connect();
    });
    act(() => {
      FakeSocket.sockets[0].open();
      FakeSocket.sockets[0].close();
    });
    expect(result.current.isFallbackToRest).toBe(true);
    await act(async () => {
      await result.current.connect();
    });
    expect(FakeSocket.sockets).toHaveLength(2);
    expect(apiClient.post).toHaveBeenCalledTimes(2);
    unmount();
  });
  it('does not create a socket when a ticket arrives after disconnect', async () => {
    let resolveTicket!: (value: any) => void;
    vi.mocked(apiClient.post).mockReturnValue(
      new Promise(resolve => {
        resolveTicket = resolve;
      }),
    );
    const { result, unmount } = renderHook(() => useVoiceStreaming('interview'));
    let connection!: Promise<void>;
    act(() => {
      connection = result.current.connect();
      result.current.disconnect();
    });
    await act(async () => {
      resolveTicket({ ticket: 'late-ticket' });
      await connection;
    });
    expect(FakeSocket.sockets).toHaveLength(0);
    unmount();
  });
  it('shows authentication failures without opening an unauthenticated socket', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Consent required'));
    const { result, unmount } = renderHook(() => useVoiceStreaming('interview'));
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.errorMessage).toBe('Consent required');
    expect(FakeSocket.sockets).toHaveLength(0);
    unmount();
  });
  it('retains uncommitted speech and closes streaming for text fallback', async () => {
    const { result, unmount } = renderHook(() => useVoiceStreaming('interview'));
    await act(async () => {
      await result.current.connect();
    });
    act(() => {
      FakeSocket.sockets[0].open();
      FakeSocket.sockets[0].message({
        type: VoiceEventType.FALLBACK_TO_TEXT,
        uncommittedTranscript: 'My answer',
      });
    });
    expect(result.current.uncommittedTranscript).toBe('My answer');
    expect(FakeSocket.sockets[0].close).toHaveBeenCalled();
    unmount();
  });
  it('counts a manual interruption only once when acknowledged', async () => {
    const { result, unmount } = renderHook(() => useVoiceStreaming('interview'));
    await act(async () => {
      await result.current.connect();
    });
    act(() => {
      FakeSocket.sockets[0].open();
      result.current.triggerBargeIn();
      FakeSocket.sockets[0].message({ type: VoiceEventType.INTERRUPT });
    });
    expect(result.current.bargeInCount).toBe(1);
    unmount();
  });
  it('ignores late recording results and keeps the connection usable after playback failure', async () => {
    const { result, unmount } = renderHook(() => useVoiceStreaming('interview'));
    await act(async () => {
      await result.current.connect();
    });
    act(() => {
      FakeSocket.sockets[0].open();
      FakeSocket.sockets[0].message({ type: VoiceEventType.CONNECTED });
      result.current.startRecording('turn1');
    });
    const socket = FakeSocket.sockets[0];
    const request = socket.send.mock.calls
      .map(call => JSON.parse(call[0]))
      .find(value => value.type === 'voice:recording-start');
    act(() => {
      socket.message({
        type: 'voice:recording-draft',
        recordingId: request.recordingId,
        text: 'Reviewed draft',
      });
      socket.message({
        type: 'voice:recording-stopped',
        recordingId: request.recordingId,
        text: 'Reviewed draft',
      });
      socket.message({
        type: 'voice:recording-draft',
        recordingId: request.recordingId,
        text: 'Late replacement',
      });
      socket.message({ type: 'voice:playback-error', message: 'Playback unavailable' });
    });
    expect(result.current.recordingText).toBe('Reviewed draft');
    expect(result.current.recordingStatus).toBe('IDLE');
    expect(result.current.connectionStatus).toBe('LIVE');
    expect(socket.close).not.toHaveBeenCalled();
    unmount();
  });
  it('times out when the socket opens but the server never acknowledges the session', async () => {
    const { result, unmount } = renderHook(() => useVoiceStreaming('interview'));
    await act(async () => {
      await result.current.connect();
    });
    act(() => {
      FakeSocket.sockets[0].open();
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.isFallbackToRest).toBe(true);
    expect(FakeSocket.sockets[0].close).toHaveBeenCalled();
    unmount();
  });
  it('opens the microphone only on request and preserves the connection on denial', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error('Microphone denied')) },
    });
    const { result, unmount } = renderHook(() => useVoiceStreaming('interview'));
    await act(async () => {
      await result.current.connect();
    });
    await act(async () => {
      FakeSocket.sockets[0].open();
      FakeSocket.sockets[0].message({ type: VoiceEventType.CONNECTED });
    });
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    act(() => result.current.startRecording('turn1'));
    const request = FakeSocket.sockets[0].send.mock.calls
      .map(call => JSON.parse(call[0]))
      .find(value => value.type === 'voice:recording-start');
    await act(async () =>
      FakeSocket.sockets[0].message({
        type: 'voice:recording-started',
        recordingId: request.recordingId,
      }),
    );
    expect(result.current.errorMessage).toBe('Microphone denied');
    expect(result.current.isFallbackToRest).toBe(false);
    expect(result.current.connectionStatus).toBe('LIVE');
    expect(FakeSocket.sockets[0].close).not.toHaveBeenCalled();
    unmount();
  });
  it('waits for MP3 decoding and playback before clearing the AI speaking state', async () => {
    let finishDecode!: (value: any) => void;
    const source = {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null as any,
      buffer: null as any,
    };
    const context = {
      state: 'running',
      currentTime: 0,
      destination: {},
      decodeAudioData: vi.fn(
        () =>
          new Promise(resolve => {
            finishDecode = resolve;
          }),
      ),
      createBufferSource: vi.fn(() => source),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal('AudioContext', function () {
      return context;
    });
    const { result, unmount } = renderHook(() => useVoiceStreaming('interview'));
    await act(async () => {
      await result.current.connect();
    });
    act(() => {
      const socket = FakeSocket.sockets[0];
      socket.open();
      socket.message({ type: VoiceEventType.AI_SPEAKING_START, text: 'Xin chào' });
      socket.message({ type: 'voice:audio-format', codec: 'mp3' });
      socket.onmessage({ data: new ArrayBuffer(4) });
      socket.message({ type: VoiceEventType.AI_SPEAKING_END });
    });
    expect(result.current.isAiSpeaking).toBe(true);
    await act(async () => {
      await Promise.resolve();
      finishDecode({ duration: 2 });
    });
    expect(source.start).toHaveBeenCalled();
    expect(result.current.isAiSpeaking).toBe(true);
    act(() => {
      source.onended();
    });
    expect(result.current.isAiSpeaking).toBe(false);
    unmount();
  });
});
