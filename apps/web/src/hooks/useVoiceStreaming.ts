import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceEventType, SpeakerRole } from '@ai-interview/contracts';

export interface TranscriptItem {
  speaker: SpeakerRole;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface NetworkQuality {
  latencyMs: number;
  jitterMs: number;
  packetLossRate: number;
  quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
}

export function useVoiceStreaming(interviewId?: string) {
  const [connectionStatus, setConnectionStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'LIVE' | 'ENDED' | 'ERROR'>('DISCONNECTED');
  const [isMuted, setIsMuted] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isCandidateSpeaking, setIsCandidateSpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>({
    latencyMs: 25,
    jitterMs: 3,
    packetLossRate: 0,
    quality: 'EXCELLENT',
  });
  const [bargeInCount, setBargeInCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // 1. Connect to Voice WebSocket Gateway
  const connect = useCallback(() => {
    if (!interviewId || wsRef.current) return;

    setConnectionStatus('CONNECTING');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/voice`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setConnectionStatus('LIVE');
      ws.send(JSON.stringify({
        type: VoiceEventType.CONNECT,
        interviewId,
      }));
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          handleServerJsonEvent(msg);
        } catch (e) {
          // ignore
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Play binary audio chunk from AI interviewer
        playAudioChunk(event.data);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('ENDED');
      stopMicrophone();
    };

    ws.onerror = () => {
      setConnectionStatus('ERROR');
      stopMicrophone();
    };
  }, [interviewId]);

  const handleServerJsonEvent = (msg: any) => {
    switch (msg.type) {
      case VoiceEventType.CONNECTED:
        setConnectionStatus('LIVE');
        startMicrophone();
        break;

      case VoiceEventType.AI_SPEAKING_START:
        setIsAiSpeaking(true);
        if (msg.text) {
          setTranscripts(prev => [
            ...prev,
            { speaker: SpeakerRole.AI, text: msg.text, isFinal: true, timestamp: Date.now() },
          ]);
        }
        break;

      case VoiceEventType.AI_SPEAKING_END:
        setIsAiSpeaking(false);
        break;

      case VoiceEventType.FINAL_TRANSCRIPT:
        if (msg.text) {
          setTranscripts(prev => [
            ...prev,
            { speaker: msg.speaker || SpeakerRole.USER, text: msg.text, isFinal: true, timestamp: Date.now() },
          ]);
        }
        break;

      case VoiceEventType.INTERRUPT:
        setIsAiSpeaking(false);
        setBargeInCount(prev => prev + 1);
        break;

      case VoiceEventType.CONNECTION_QUALITY:
        setNetworkQuality({
          latencyMs: msg.latencyMs || 20,
          jitterMs: msg.jitterMs || 2,
          packetLossRate: msg.packetLossRate || 0,
          quality: msg.quality || 'EXCELLENT',
        });
        break;

      case VoiceEventType.DISCONNECT:
        setConnectionStatus('ENDED');
        break;
    }
  };

  // 2. Microphone Capture
  const startMicrophone = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMuted || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcm16 = new Int16Array(inputData.length);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          sum += Math.abs(s);
        }

        const avgVolume = sum / inputData.length;
        setIsCandidateSpeaking(avgVolume > 0.03);

        wsRef.current.send(pcm16.buffer);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err) {
      console.warn('Microphone capture not supported in this environment:', err);
    }
  };

  const stopMicrophone = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  // 3. Audio Chunk Playback
  const playAudioChunk = async (arrayBuffer: ArrayBuffer) => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Convert PCM16 Int16 to AudioBuffer
      const int16 = new Int16Array(arrayBuffer);
      const audioBuffer = ctx.createBuffer(1, int16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < int16.length; i++) {
        channelData[i] = int16[i] / 32768.0;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
    } catch (e) {
      // AudioContext playback fallback
    }
  };

  // 4. Client Controls
  const triggerBargeIn = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: VoiceEventType.INTERRUPT }));
      setIsAiSpeaking(false);
      setBargeInCount(prev => prev + 1);
    }
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  const disconnect = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: VoiceEventType.DISCONNECT }));
      wsRef.current.close();
    }
    stopMicrophone();
    setConnectionStatus('ENDED');
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    connectionStatus,
    connect,
    disconnect,
    isMuted,
    toggleMute,
    isAiSpeaking,
    isCandidateSpeaking,
    transcripts,
    networkQuality,
    bargeInCount,
    triggerBargeIn,
  };
}
