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
  const [connectionStatus, setConnectionStatus] = useState<
    'DISCONNECTED' | 'CONNECTING' | 'LIVE' | 'ENDED' | 'ERROR'
  >('DISCONNECTED');
  const [isMuted, setIsMuted] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isCandidateSpeaking, setIsCandidateSpeaking] = useState(false);
  const [candidateVolume, setCandidateVolume] = useState(0);
  const [aiVolume, setAiVolume] = useState(0);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>({
    latencyMs: 22,
    jitterMs: 2,
    packetLossRate: 0,
    quality: 'EXCELLENT',
  });
  const [bargeInCount, setBargeInCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pingIntervalRef = useRef<any>(null);

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
      ws.send(
        JSON.stringify({
          type: VoiceEventType.CONNECT,
          interviewId,
        }),
      );

      // Start ping loop for real-time latency measurement
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const pingStart = Date.now();
          ws.send(JSON.stringify({ type: 'ping', clientTimestamp: pingStart }));
        }
      }, 3000);
    };

    ws.onmessage = async event => {
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
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };

    ws.onerror = () => {
      setConnectionStatus('ERROR');
      stopMicrophone();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
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
        setAiVolume(0);
        break;

      case VoiceEventType.INTERIM_TRANSCRIPT:
        if (msg.text) {
          setTranscripts(prev => {
            const filtered = prev.filter(t => t.isFinal || t.speaker !== SpeakerRole.USER);
            return [
              ...filtered,
              { speaker: SpeakerRole.USER, text: msg.text, isFinal: false, timestamp: Date.now() },
            ];
          });
        }
        break;

      case VoiceEventType.FINAL_TRANSCRIPT:
        if (msg.text) {
          setTranscripts(prev => {
            const filtered = prev.filter(t => t.isFinal);
            return [
              ...filtered,
              {
                speaker: msg.speaker || SpeakerRole.USER,
                text: msg.text,
                isFinal: true,
                timestamp: Date.now(),
              },
            ];
          });
        }
        break;

      case VoiceEventType.INTERRUPT:
        setIsAiSpeaking(false);
        setAiVolume(0);
        setBargeInCount(prev => prev + 1);
        break;

      case VoiceEventType.CONNECTION_QUALITY:
        setNetworkQuality({
          latencyMs: msg.latencyMs || 22,
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

  // 2. Microphone Capture with AudioWorkletNode & ScriptProcessor fallback
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
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);

      // Attempt to load AudioWorkletProcessor
      let workletLoaded = false;
      if (audioCtx.audioWorklet) {
        try {
          await audioCtx.audioWorklet.addModule('/worklets/recorderWorkletProcessor.js');
          const workletNode = new AudioWorkletNode(audioCtx, 'recorder-worklet');
          workletNodeRef.current = workletNode;

          workletNode.port.onmessage = (event: MessageEvent) => {
            if (isMuted || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
            const buffer = event.data as ArrayBuffer;
            const int16 = new Int16Array(buffer);
            let sum = 0;
            for (let i = 0; i < int16.length; i++) {
              sum += Math.abs(int16[i]);
            }
            const avg = sum / int16.length / 32768.0;
            setCandidateVolume(avg);
            setIsCandidateSpeaking(avg > 0.03);

            wsRef.current.send(buffer);
          };

          source.connect(workletNode);
          workletNode.connect(audioCtx.destination);
          workletLoaded = true;
        } catch {
          workletLoaded = false;
        }
      }

      // Fallback for environments without AudioWorklet support
      if (!workletLoaded && typeof audioCtx.createScriptProcessor === 'function') {
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;

        processor.onaudioprocess = e => {
          if (isMuted || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            sum += Math.abs(s);
          }

          const avgVolume = sum / inputData.length;
          setCandidateVolume(avgVolume);
          setIsCandidateSpeaking(avgVolume > 0.03);

          wsRef.current.send(pcm16.buffer);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      }
    } catch (err) {
      console.warn('Microphone capture initialization failed:', err);
    }
  };

  const stopMicrophone = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
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
        if (!AudioCtx) return;
        audioContextRef.current = new AudioCtx({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const int16 = new Int16Array(arrayBuffer);
      let sum = 0;
      for (let i = 0; i < int16.length; i++) {
        sum += Math.abs(int16[i]);
      }
      setAiVolume(sum / int16.length / 32768.0);

      const audioBuffer = ctx.createBuffer(1, int16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < int16.length; i++) {
        channelData[i] = int16[i] / 32768.0;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
    } catch {
      // AudioContext playback fallback
    }
  };

  // 4. Client Controls
  const triggerBargeIn = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: VoiceEventType.INTERRUPT }));
      setIsAiSpeaking(false);
      setAiVolume(0);
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
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
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
    candidateVolume,
    aiVolume,
    transcripts,
    networkQuality,
    bargeInCount,
    triggerBargeIn,
  };
}
