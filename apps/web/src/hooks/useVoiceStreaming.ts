import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceEventType, SpeakerRole } from '@ai-interview/contracts';
import { apiClient } from '../lib/api-client';

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
  const [isMuted, setIsMuted] = useState(true);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isCandidateSpeaking, setIsCandidateSpeaking] = useState(false);
  const [candidateVolume, setCandidateVolume] = useState(0);
  const [aiVolume, setAiVolume] = useState(0);
  const [silenceDurationSec, setSilenceDurationSec] = useState(0);
  const [isProlongedSilence, setIsProlongedSilence] = useState(false);
  const [isFallbackToRest, setIsFallbackToRest] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>({
    latencyMs: 22,
    jitterMs: 2,
    packetLossRate: 0,
    quality: 'EXCELLENT',
  });
  const [bargeInCount, setBargeInCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uncommittedTranscript, setUncommittedTranscript] = useState('');
  const pendingTranscriptRef = useRef('');
  const [recordingStatus, setRecordingStatus] = useState<
    'IDLE' | 'STARTING' | 'RECORDING' | 'FINALIZING'
  >('IDLE');
  const [recordingText, setRecordingText] = useState('');
  const recordingIdRef = useRef<string | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const captureFlushRef = useRef<(() => void) | null>(null);
  const decodeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const acceptingPlaybackRef = useRef(true);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const connectionGenerationRef = useRef(0);
  const connectingRef = useRef(false);
  const playbackGenerationRef = useRef(0);
  const playbackCodecRef = useRef<'pcm16' | 'mp3'>('pcm16');
  const pendingDecodesRef = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const aiSpeakingEndReceivedRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pingIntervalRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const mediaGenerationRef = useRef(0);

  const isCandidateSpeakingRef = useRef(false);
  const isAiSpeakingRef = useRef(false);
  const isMutedRef = useRef(false);

  isCandidateSpeakingRef.current = isCandidateSpeaking;
  isAiSpeakingRef.current = isAiSpeaking;
  isMutedRef.current = isMuted;

  const stopAiAudio = useCallback(() => {
    playbackGenerationRef.current += 1;
    pendingDecodesRef.current = 0;
    decodeQueueRef.current = Promise.resolve();
    scheduledSourcesRef.current.forEach(s => {
      try {
        s.stop();
        s.disconnect();
      } catch {
        // ignore disconnect error
      }
    });
    scheduledSourcesRef.current = [];
    if (playbackAudioContextRef.current) {
      nextPlayTimeRef.current = playbackAudioContextRef.current.currentTime;
    } else {
      nextPlayTimeRef.current = 0;
    }
    aiSpeakingEndReceivedRef.current = false;
    setIsAiSpeaking(false);
    setAiVolume(0);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      mediaGenerationRef.current += 1;
      stopAiAudio();
    };
  }, [stopAiAudio]);

  // 1. Resource Cleanup to Prevent Memory & Socket Leaks
  const stopMicrophone = useCallback(() => {
    mediaGenerationRef.current += 1;
    setIsMuted(true);
    isMutedRef.current = true;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      mediaStreamRef.current = null;
    }
    if (workletNodeRef.current) {
      try {
        if (workletNodeRef.current.port) {
          workletNodeRef.current.port.onmessage = null;
        }
        workletNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      workletNodeRef.current = null;
    }
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.onaudioprocess = null;
        scriptProcessorRef.current.disconnect();
      } catch {
        // ignore
      }
      scriptProcessorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setCandidateVolume(0);
    setIsCandidateSpeaking(false);
  }, [stopAiAudio]);

  const resetSilenceTimer = useCallback(() => {
    setSilenceDurationSec(0);
    setIsProlongedSilence(false);
  }, []);

  // 2. Connect to Voice WebSocket Gateway
  const connect = useCallback(async () => {
    if (!interviewId || wsRef.current || connectingRef.current) return;
    connectingRef.current = true;
    const generation = ++connectionGenerationRef.current;

    setConnectionStatus('CONNECTING');
    setIsFallbackToRest(false);
    setErrorMessage(null);

    let ticket: string | undefined;
    try {
      const res = await apiClient.post<{ ticket?: string; data?: { ticket?: string } }>(
        '/voice-gateway/ticket',
        { interviewId },
      );
      ticket = (res as any)?.ticket || (res as any)?.data?.ticket;
    } catch (err: any) {
      if (generation !== connectionGenerationRef.current) return;
      connectingRef.current = false;
      setConnectionStatus('ERROR');
      setErrorMessage(err?.message || 'Không thể cấp quyền kết nối giọng nói.');
      setIsFallbackToRest(true);
      return;
    }

    if (!isMountedRef.current || generation !== connectionGenerationRef.current) return;
    if (!ticket) {
      connectingRef.current = false;
      setConnectionStatus('ERROR');
      setErrorMessage('Không nhận được vé kết nối giọng nói. Vui lòng thử lại.');
      setIsFallbackToRest(true);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const baseWsUrl = import.meta.env.VITE_VOICE_WS_URL || `${protocol}//${host}/voice`;
    const wsUrl = ticket
      ? `${baseWsUrl}${baseWsUrl.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(ticket)}`
      : baseWsUrl;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      connectingRef.current = false;
      setConnectionStatus('ERROR');
      setErrorMessage(err instanceof Error ? err.message : 'Không thể mở kết nối giọng nói.');
      setIsFallbackToRest(true);
      return;
    }
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    const connectTimeoutTimer = setTimeout(() => {
      if (generation !== connectionGenerationRef.current) return;
      if (connectingRef.current) {
        setConnectionStatus('ERROR');
        setIsFallbackToRest(true);
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    }, 10000);

    ws.onopen = () => {
      if (generation !== connectionGenerationRef.current) {
        ws.close();
        return;
      }
      ws.send(
        JSON.stringify({
          type: VoiceEventType.CONNECT,
          interviewId,
          ticket,
        }),
      );

      // Start ping loop for real-time latency measurement
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const pingStart = Date.now();
          ws.send(JSON.stringify({ type: 'ping', clientTimestamp: pingStart }));
        }
      }, 3000);

      // Start silence tracking interval (evaluates every second)
      silenceTimerRef.current = setInterval(() => {
        if (!isAiSpeakingRef.current && !isMutedRef.current) {
          if (!isCandidateSpeakingRef.current) {
            setSilenceDurationSec(prev => {
              const next = prev + 1;
              if (next >= 15) {
                setIsProlongedSilence(true);
              }
              return next;
            });
          } else {
            setSilenceDurationSec(0);
            setIsProlongedSilence(false);
          }
        }
      }, 1000);
    };

    ws.onmessage = async event => {
      if (generation !== connectionGenerationRef.current) return;
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === VoiceEventType.CONNECTED) clearTimeout(connectTimeoutTimer);
          handleServerJsonEvent(msg);
        } catch (e) {
          // ignore
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Play binary audio chunk from AI interviewer
        playAudioChunk(event.data);
      } else if (event.data instanceof Blob) {
        const buffer = await event.data.arrayBuffer();
        playAudioChunk(buffer);
      }
    };

    ws.onclose = () => {
      clearTimeout(connectTimeoutTimer);
      if (generation !== connectionGenerationRef.current) return;
      wsRef.current = null;
      connectingRef.current = false;
      setConnectionStatus(prev => (prev === 'ENDED' ? prev : 'ERROR'));
      setIsFallbackToRest(true);
      stopAiAudio();
      stopMicrophone();
      recordingIdRef.current = null;
      clearTimeout(recordingTimerRef.current);
      setRecordingStatus('IDLE');
      if (pendingTranscriptRef.current) setUncommittedTranscript(pendingTranscriptRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    };

    ws.onerror = () => {
      if (generation !== connectionGenerationRef.current) return;
      clearTimeout(connectTimeoutTimer);
      setConnectionStatus('ERROR');
      setIsFallbackToRest(true);
      stopMicrophone();
      recordingIdRef.current = null;
      clearTimeout(recordingTimerRef.current);
      setRecordingStatus('IDLE');
      stopAiAudio();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    };
  }, [interviewId, stopMicrophone]);

  const handleServerJsonEvent = (msg: any) => {
    switch (msg.type) {
      case 'voice:recording-started':
        if (msg.recordingId !== recordingIdRef.current) break;
        clearTimeout(recordingTimerRef.current);
        void startMicrophone();
        break;
      case 'voice:recording-draft':
        if (msg.recordingId === recordingIdRef.current) {
          pendingTranscriptRef.current = msg.text || '';
          setRecordingText(msg.text || '');
        }
        break;
      case 'voice:recording-stopped':
      case 'voice:recording-error':
        if (msg.recordingId !== recordingIdRef.current) break;
        if (typeof msg.text === 'string') {
          setRecordingText(msg.text);
          pendingTranscriptRef.current = msg.text;
        }
        recordingIdRef.current = null;
        clearTimeout(recordingTimerRef.current);
        stopMicrophone();
        setRecordingStatus('IDLE');
        if (msg.message) setErrorMessage(msg.message);
        break;
      case 'voice:playback-error':
        stopAiAudio();
        setErrorMessage(msg.message || 'Không thể phát câu hỏi. Bạn vẫn có thể trả lời.');
        break;
      case 'voice:audio-format':
        playbackCodecRef.current = msg.codec === 'mp3' ? 'mp3' : 'pcm16';
        break;
      case VoiceEventType.CONNECTED:
        connectingRef.current = false;
        setConnectionStatus('LIVE');
        // Microphone starts only after an explicit recording request.
        break;

      case VoiceEventType.AI_SPEAKING_START:
        if (recordingIdRef.current) break;
        acceptingPlaybackRef.current = true;
        stopAiAudio();
        setIsAiSpeaking(true);
        aiSpeakingEndReceivedRef.current = false;
        setSilenceDurationSec(0);
        setIsProlongedSilence(false);
        if (msg.text) {
          setTranscripts(prev => [
            ...prev,
            { speaker: SpeakerRole.AI, text: msg.text, isFinal: true, timestamp: Date.now() },
          ]);
        }
        break;

      case VoiceEventType.AI_SPEAKING_END:
        aiSpeakingEndReceivedRef.current = true;
        if (scheduledSourcesRef.current.length === 0 && pendingDecodesRef.current === 0) {
          setIsAiSpeaking(false);
          setAiVolume(0);
        }
        setSilenceDurationSec(0);
        break;

      case VoiceEventType.INTERIM_TRANSCRIPT:
        if (msg.text) {
          pendingTranscriptRef.current = msg.text;
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
          pendingTranscriptRef.current = '';
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
        stopAiAudio();
        setBargeInCount(prev => prev + 1);
        break;

      case VoiceEventType.CONNECTION_QUALITY: {
        const latency =
          typeof msg.clientTimestamp === 'number'
            ? Math.max(0, Date.now() - msg.clientTimestamp)
            : (msg.latencyMs ?? 0);
        setNetworkQuality({
          latencyMs: latency,
          jitterMs: msg.jitterMs ?? 0,
          packetLossRate: msg.packetLossRate ?? 0,
          quality:
            latency < 100 ? 'EXCELLENT' : latency < 250 ? 'GOOD' : latency < 500 ? 'FAIR' : 'POOR',
        });
        break;
      }

      case VoiceEventType.FALLBACK_TO_TEXT:
        setErrorMessage(msg.message || 'Kết nối giọng nói bị gián đoạn.');
        if (msg.uncommittedTranscript) setUncommittedTranscript(msg.uncommittedTranscript);
        setIsFallbackToRest(true);
        disconnect();
        break;

      case VoiceEventType.QUOTA_EXCEEDED:
        disconnect();
        setErrorMessage(msg.message || 'Hạn mức giọng nói đã hết.');
        setConnectionStatus('ERROR');
        setIsFallbackToRest(true);
        stopMicrophone();
        break;

      case VoiceEventType.ERROR:
        {
          setErrorMessage(msg.message || 'Kết nối giọng nói gặp lỗi.');
          disconnect();
          setConnectionStatus('ERROR');
          setIsFallbackToRest(true);
          stopMicrophone();
        }
        break;

      case VoiceEventType.DISCONNECT:
        if (msg.state === 'COMPLETED') setSessionCompleted(true);
        disconnect();
        setConnectionStatus('ENDED');
        break;
    }
  };

  // 3. Microphone Capture with AudioWorkletNode & ScriptProcessor fallback
  const startMicrophone = async () => {
    const generation = ++mediaGenerationRef.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          'Trình duyệt không hỗ trợ micro. Hãy dùng HTTPS và trình duyệt hỗ trợ thu âm.',
        );

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!isMountedRef.current || mediaGenerationRef.current !== generation) {
        stream.getTracks().forEach(t => {
          try {
            t.stop();
          } catch {
            // ignore track stop error on aborted stream
          }
        });
        return;
      }

      mediaStreamRef.current = stream;
      isMutedRef.current = false;
      setIsMuted(false);

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) throw new Error('Trình duyệt không hỗ trợ Web Audio.');
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      if (generation !== mediaGenerationRef.current || !isMountedRef.current) return;
      if (audioCtx.sampleRate !== 16000)
        throw new Error('Thiết bị không hỗ trợ thu âm 16 kHz. Vui lòng dùng chế độ nhập chữ.');

      const source = audioCtx.createMediaStreamSource(stream);

      // Attempt to load AudioWorkletProcessor
      let workletLoaded = false;
      if (audioCtx.audioWorklet) {
        try {
          await audioCtx.audioWorklet.addModule('/worklets/recorderWorkletProcessor.js');
          if (generation !== mediaGenerationRef.current || !isMountedRef.current) return;
          const workletNode = new AudioWorkletNode(audioCtx, 'recorder-worklet');
          workletNodeRef.current = workletNode;

          workletNode.port.onmessage = (event: MessageEvent) => {
            if (event.data?.type === 'flushed') {
              captureFlushRef.current?.();
              return;
            }
            if (isMutedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
              return;
            const buffer = event.data as ArrayBuffer;
            const int16 = new Int16Array(buffer);
            let sum = 0;
            for (let i = 0; i < int16.length; i++) {
              sum += Math.abs(int16[i]);
            }
            const avg = sum / int16.length / 32768.0;
            setCandidateVolume(avg);
            const speaking = avg > 0.03;
            setIsCandidateSpeaking(speaking);
            if (speaking) {
              setSilenceDurationSec(0);
              setIsProlongedSilence(false);
            }

            wsRef.current.send(buffer);
          };

          source.connect(workletNode);
          workletNode.connect(audioCtx.destination);
          workletLoaded = true;
        } catch {
          workletLoaded = false;
        }
      }
      if (generation !== mediaGenerationRef.current || !isMountedRef.current) return;

      // Fallback for environments without AudioWorklet support
      if (!workletLoaded && typeof audioCtx.createScriptProcessor === 'function') {
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;

        processor.onaudioprocess = e => {
          if (isMutedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
            return;

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
          const speaking = avgVolume > 0.03;
          setIsCandidateSpeaking(speaking);
          if (speaking) {
            setSilenceDurationSec(0);
            setIsProlongedSilence(false);
          }

          wsRef.current.send(pcm16.buffer);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      }
      setRecordingStatus('RECORDING');
    } catch (err) {
      console.warn('Microphone capture initialization failed:', err);
      if (generation !== mediaGenerationRef.current) return;
      if (wsRef.current?.readyState === WebSocket.OPEN)
        wsRef.current.send(
          JSON.stringify({ type: 'voice:recording-stop', recordingId: recordingIdRef.current }),
        );
      recordingIdRef.current = null;
      stopMicrophone();
      setRecordingStatus('IDLE');
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Không thể bật micro. Vui lòng kiểm tra quyền truy cập.',
      );
    }
  };

  // 4. Audio Chunk Playback & Browser Autoplay Unlock
  const initPlaybackAudio = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!playbackAudioContextRef.current || playbackAudioContextRef.current.state === 'closed') {
        try {
          playbackAudioContextRef.current = new AudioCtx({ sampleRate: 24000 });
        } catch {
          playbackAudioContextRef.current = new AudioCtx();
        }
      }
      const ctx = playbackAudioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      // Unlock Web Audio engine via 1-sample silent sound
      const buffer = ctx.createBuffer(1, 1, 24000);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      console.warn('[VoiceStreaming] AudioContext unlock warning:', e);
    }
  }, []);

  const playAudioChunk = (arrayBuffer: ArrayBuffer) => {
    if (!acceptingPlaybackRef.current) return;
    const generation = playbackGenerationRef.current;
    const codec = playbackCodecRef.current;
    pendingDecodesRef.current += 1;
    decodeQueueRef.current = decodeQueueRef.current.then(async () => {
      if (generation !== playbackGenerationRef.current) return;
      try {
        if (
          !playbackAudioContextRef.current ||
          playbackAudioContextRef.current.state === 'closed'
        ) {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioCtx) return;
          try {
            playbackAudioContextRef.current = new AudioCtx({ sampleRate: 24000 });
          } catch {
            playbackAudioContextRef.current = new AudioCtx();
          }
        }
        const ctx = playbackAudioContextRef.current;
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }
        if (generation !== playbackGenerationRef.current || !isMountedRef.current) return;

        let audioBuffer: AudioBuffer;
        if (codec === 'mp3') {
          audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          if (generation !== playbackGenerationRef.current || !isMountedRef.current) return;
          setAiVolume(0.2);
        } else {
          const sampleCount = Math.floor(arrayBuffer.byteLength / 2);
          if (sampleCount === 0) return;
          const int16 = new Int16Array(arrayBuffer, 0, sampleCount);
          let sum = 0;
          audioBuffer = ctx.createBuffer(1, sampleCount, 24000);
          const channelData = audioBuffer.getChannelData(0);
          for (let i = 0; i < sampleCount; i++) {
            sum += Math.abs(int16[i]);
            channelData[i] = int16[i] / 32768.0;
          }
          setAiVolume(sum / sampleCount / 32768.0);
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        scheduledSourcesRef.current.push(source);
        source.onended = () => {
          scheduledSourcesRef.current = scheduledSourcesRef.current.filter(s => s !== source);
          if (
            scheduledSourcesRef.current.length === 0 &&
            pendingDecodesRef.current === 0 &&
            aiSpeakingEndReceivedRef.current
          ) {
            setIsAiSpeaking(false);
            setAiVolume(0);
          }
        };

        const now = ctx.currentTime;
        if (nextPlayTimeRef.current < now) {
          nextPlayTimeRef.current = now;
        }
        const startTime = nextPlayTimeRef.current;
        source.start(startTime);
        nextPlayTimeRef.current = startTime + audioBuffer.duration;
      } catch (err) {
        console.error('[VoiceStreaming] Audio playback error:', err);
        if (generation === playbackGenerationRef.current) {
          setErrorMessage(
            'Không thể phát âm thanh. Vui lòng kiểm tra thiết bị âm thanh và thử lại.',
          );
          stopAiAudio();
        }
      } finally {
        if (generation === playbackGenerationRef.current) {
          pendingDecodesRef.current = Math.max(0, pendingDecodesRef.current - 1);
          if (
            pendingDecodesRef.current === 0 &&
            scheduledSourcesRef.current.length === 0 &&
            aiSpeakingEndReceivedRef.current
          ) {
            setIsAiSpeaking(false);
            setAiVolume(0);
          }
        }
      }
    });
  };

  // 5. Client Controls
  const triggerBargeIn = () => {
    acceptingPlaybackRef.current = false;
    stopAiAudio();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: VoiceEventType.INTERRUPT }));
    }
  };

  const startRecording = (turnId: string) => {
    if (recordingIdRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
    triggerBargeIn();
    setErrorMessage(null);
    setRecordingText('');
    pendingTranscriptRef.current = '';
    const id = crypto.randomUUID();
    recordingIdRef.current = id;
    setRecordingStatus('STARTING');
    wsRef.current.send(JSON.stringify({ type: 'voice:recording-start', turnId, recordingId: id }));
    recordingTimerRef.current = setTimeout(() => {
      if (recordingIdRef.current !== id) return;
      disconnect();
      setErrorMessage('Không thể bắt đầu nhận diện. Hãy kết nối lại hoặc nhập chữ.');
    }, 10000);
  };

  const stopRecording = async () => {
    const id = recordingIdRef.current;
    if (!id) return;
    setRecordingStatus('FINALIZING');
    if (workletNodeRef.current) {
      await new Promise<void>(resolve => {
        const timeout = setTimeout(resolve, 300);
        captureFlushRef.current = () => {
          clearTimeout(timeout);
          resolve();
        };
        workletNodeRef.current?.port.postMessage({ type: 'flush' });
      });
      captureFlushRef.current = null;
    }
    stopMicrophone();
    if (recordingIdRef.current !== id) return;
    wsRef.current?.send(JSON.stringify({ type: 'voice:recording-stop', recordingId: id }));
    recordingTimerRef.current = setTimeout(() => {
      if (recordingIdRef.current !== id) return;
      disconnect();
      setErrorMessage('Nhận diện chưa xác nhận hoàn tất. Hãy kiểm tra bản nháp trước khi gửi.');
    }, 10000);
  };

  const replayQuestion = (turnId: string) => {
    if (recordingIdRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
    triggerBargeIn();
    wsRef.current.send(JSON.stringify({ type: 'voice:replay', turnId }));
  };
  const toggleMute = () => {
    if (recordingIdRef.current) void stopRecording();
  };

  const disconnect = useCallback(() => {
    connectionGenerationRef.current += 1;
    connectingRef.current = false;
    recordingIdRef.current = null;
    clearTimeout(recordingTimerRef.current);
    setRecordingStatus('IDLE');
    stopAiAudio();
    if (playbackAudioContextRef.current?.state !== 'closed')
      playbackAudioContextRef.current?.close().catch(() => {});
    playbackAudioContextRef.current = null;
    if (wsRef.current) {
      const ws = wsRef.current;
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: VoiceEventType.DISCONNECT }));
          ws.close();
        } catch {
          // ignore
        }
      }
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.CONNECTING) ws.close();
      wsRef.current = null;
    }
    stopMicrophone();
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setConnectionStatus('ENDED');
  }, [stopMicrophone, stopAiAudio]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    recordingStatus,
    recordingText,
    startRecording,
    stopRecording,
    replayQuestion,
    errorMessage,
    uncommittedTranscript,
    sessionCompleted,
    connectionStatus,
    connect,
    disconnect,
    isMuted,
    toggleMute,
    isAiSpeaking,
    isCandidateSpeaking,
    candidateVolume,
    aiVolume,
    silenceDurationSec,
    isProlongedSilence,
    resetSilenceTimer,
    isFallbackToRest,
    transcripts,
    networkQuality,
    bargeInCount,
    triggerBargeIn,
    initPlaybackAudio,
  };
}
