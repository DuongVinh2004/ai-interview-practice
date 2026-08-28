import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseAudioRecorderOptions {
  maxDuration?: number; // Maximum duration in seconds, default 300 (5 minutes)
  onMaxDuration?: () => void;
  silenceThreshold?: number; // Audio level threshold below which is considered silence (0-100), default 5
  prolongedSilenceSeconds?: number; // Silence duration in seconds to trigger warning, default 15
}

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingDuration: number;
  remainingDuration: number;
  isNearMaxDuration: boolean; // <= 30 seconds remaining
  isMaxDurationReached: boolean;
  audioLevel: number; // 0 to 100
  silenceDuration: number; // Consecutive seconds with silence
  isProlongedSilence: boolean; // True if silenceDuration >= 15s
  resetSilenceTimer: () => void;
  audioBlob: Blob | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
  getAnalyserData: () => Uint8Array | null;
}

export const MAX_AUDIO_DURATION_SECONDS = 300; // 5 minutes hard limit

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderReturn {
  const maxDuration = options.maxDuration ?? MAX_AUDIO_DURATION_SECONDS;
  const silenceThreshold = options.silenceThreshold ?? 5;
  const prolongedSilenceLimit = options.prolongedSilenceSeconds ?? 15;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [silenceDuration, setSilenceDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const onMaxDurationRef = useRef(options.onMaxDuration);
  onMaxDurationRef.current = options.onMaxDuration;

  const currentAudioLevelRef = useRef(0);
  const isMountedRef = useRef(true);
  const mediaGenerationRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      mediaGenerationRef.current += 1;
    };
  }, []);

  // Audio level meter loop
  const updateAudioMeter = useCallback(() => {
    if (!analyserNodeRef.current) return;
    const dataArray = new Uint8Array(analyserNodeRef.current.frequencyBinCount);
    analyserNodeRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    const normalizedLevel = Math.min(100, Math.round((avg / 255) * 100));

    currentAudioLevelRef.current = normalizedLevel;
    setAudioLevel(normalizedLevel);

    animationFrameRef.current = requestAnimationFrame(updateAudioMeter);
  }, []);

  const getAnalyserData = useCallback((): Uint8Array | null => {
    if (!analyserNodeRef.current) return null;
    const dataArray = new Uint8Array(analyserNodeRef.current.frequencyBinCount);
    analyserNodeRef.current.getByteFrequencyData(dataArray);
    return dataArray;
  }, []);

  const cleanupAudioStream = useCallback(() => {
    mediaGenerationRef.current += 1;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current;
      recorder.ondataavailable = null;
      recorder.onerror = null;
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // ignore
        }
      }
      mediaRecorderRef.current = null;
    }
    analyserNodeRef.current = null;
    currentAudioLevelRef.current = 0;
    setAudioLevel(0);
  }, []);

  const resetSilenceTimer = useCallback(() => {
    setSilenceDuration(0);
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise(resolve => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanupAudioStream();
        setIsRecording(false);
        setIsPaused(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        cleanupAudioStream();
        setIsRecording(false);
        setIsPaused(false);
        resolve(blob);
      };

      try {
        recorder.stop();
      } catch {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        cleanupAudioStream();
        setIsRecording(false);
        setIsPaused(false);
        resolve(blob);
      }
    });
  }, [cleanupAudioStream]);

  const startRecording = useCallback(async () => {
    const generation = ++mediaGenerationRef.current;
    setError(null);
    setAudioBlob(null);
    audioChunksRef.current = [];
    setRecordingDuration(0);
    setSilenceDuration(0);

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('MediaDevices API is not supported in this browser environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!isMountedRef.current || mediaGenerationRef.current !== generation) {
        stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch {
            // ignore track stop error on aborted stream
          }
        });
        return;
      }

      mediaStreamRef.current = stream;

      // Setup Web Audio Analyser
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserNodeRef.current = analyser;
        updateAudioMeter();
      }

      // Determine supported mimeType
      let mimeType = 'audio/webm;codecs=opus';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            mimeType = 'audio/ogg';
          } else {
            mimeType = '';
          }
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = event => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250); // Slice chunks every 250ms
      setIsRecording(true);
      setIsPaused(false);

      // Start duration and silence timer
      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const currentElapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingDuration(currentElapsed);

        // VAD Silence detection tracking
        if (currentAudioLevelRef.current < silenceThreshold) {
          setSilenceDuration(prev => prev + 1);
        } else {
          setSilenceDuration(0);
        }

        // Hard duration cap enforcement (5 minutes / maxDuration)
        if (currentElapsed >= maxDuration) {
          if (onMaxDurationRef.current) {
            onMaxDurationRef.current();
          }
          stopRecording();
        }
      }, 1000);
    } catch (err: any) {
      cleanupAudioStream();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('MICROPHONE_PERMISSION_DENIED');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('MICROPHONE_NOT_FOUND');
      } else {
        setError(err.message || 'Failed to start microphone recording.');
      }
      setIsRecording(false);
    }
  }, [cleanupAudioStream, maxDuration, silenceThreshold, stopRecording, updateAudioMeter]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const next = prev + 1;
          if (next >= maxDuration) {
            if (onMaxDurationRef.current) {
              onMaxDurationRef.current();
            }
            stopRecording();
          }
          return next;
        });

        if (currentAudioLevelRef.current < silenceThreshold) {
          setSilenceDuration(prev => prev + 1);
        } else {
          setSilenceDuration(0);
        }
      }, 1000);
    }
  }, [maxDuration, silenceThreshold, stopRecording]);

  const resetRecording = useCallback(() => {
    cleanupAudioStream();
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
    setSilenceDuration(0);
    setAudioBlob(null);
    setError(null);
    audioChunksRef.current = [];
  }, [cleanupAudioStream]);

  useEffect(() => {
    return () => {
      cleanupAudioStream();
    };
  }, [cleanupAudioStream]);

  const remainingDuration = Math.max(0, maxDuration - recordingDuration);
  const isNearMaxDuration = isRecording && remainingDuration <= 30;
  const isMaxDurationReached = recordingDuration >= maxDuration;
  const isProlongedSilence = isRecording && silenceDuration >= prolongedSilenceLimit;

  return {
    isRecording,
    isPaused,
    recordingDuration,
    remainingDuration,
    isNearMaxDuration,
    isMaxDurationReached,
    audioLevel,
    silenceDuration,
    isProlongedSilence,
    resetSilenceTimer,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    getAnalyserData,
  };
}
