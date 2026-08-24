import { useState, useRef, useCallback, useEffect } from 'react';
import { apiClient } from '../lib/api-client';
import { useAudioSettingsStore } from '../stores/audio-settings.store';
import { SynthesizeSpeechResponse, AudioVoice } from '@ai-interview/contracts';

export interface UseSpeechSynthesizerReturn {
  isSpeaking: boolean;
  isPaused: boolean;
  isLoading: boolean;
  currentText: string | null;
  error: string | null;
  speak: (text: string, overrideVoice?: AudioVoice, overrideSpeed?: number) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  replay: () => void;
  getAnalyserData: () => Uint8Array | null;
}

export function useSpeechSynthesizer(): UseSpeechSynthesizerReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { voice, playbackSpeed } = useAudioSettingsStore();

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const lastSpokenTextRef = useRef<string | null>(null);
  const usingNativeSpeechRef = useRef<boolean>(false);

  const cleanupAudio = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
      audioElementRef.current.onended = null;
      audioElementRef.current.onerror = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setIsLoading(false);
  }, []);

  const getAnalyserData = useCallback((): Uint8Array | null => {
    if (!analyserNodeRef.current) return null;
    const dataArray = new Uint8Array(analyserNodeRef.current.frequencyBinCount);
    analyserNodeRef.current.getByteFrequencyData(dataArray);
    return dataArray;
  }, []);

  const speakNative = useCallback((text: string, speed: number = 1.0) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsSpeaking(false);
      setIsLoading(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speed;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      setIsLoading(false);
      usingNativeSpeechRef.current = true;
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      usingNativeSpeechRef.current = false;
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setIsLoading(false);
      usingNativeSpeechRef.current = false;
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(
    async (text: string, overrideVoice?: AudioVoice, overrideSpeed?: number) => {
      if (!text || text.trim().length === 0) return;

      cleanupAudio();
      setError(null);
      setIsLoading(true);
      setCurrentText(text);
      lastSpokenTextRef.current = text;

      const activeVoice = overrideVoice || voice;
      const activeSpeed = overrideSpeed || playbackSpeed;

      try {
        // 1. Try Cloud TTS API
        const response = await apiClient<SynthesizeSpeechResponse>('/audio/synthesize', {
          method: 'POST',
          body: JSON.stringify({
            text,
            voice: activeVoice,
            speed: activeSpeed,
          }),
        });

        if (response && response.audioBase64) {
          const audioSrc = `data:${response.mimeType || 'audio/mpeg'};base64,${response.audioBase64}`;
          const audio = new Audio(audioSrc);
          audio.playbackRate = activeSpeed;
          audioElementRef.current = audio;

          // Connect Web Audio API Analyser for playback visualization
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            try {
              if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new AudioCtx();
              }
              const audioCtx = audioContextRef.current;
              if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
              }

              if (!sourceNodeRef.current) {
                const source = audioCtx.createMediaElementSource(audio);
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.8;
                source.connect(analyser);
                analyser.connect(audioCtx.destination);
                sourceNodeRef.current = source;
                analyserNodeRef.current = analyser;
              }
            } catch {
              // Ignore audio context routing errors on some browsers
            }
          }

          audio.onended = () => {
            setIsSpeaking(false);
            setIsPaused(false);
          };

          audio.onerror = () => {
            // Fallback to browser native speech synthesis
            speakNative(text, activeSpeed);
          };

          await audio.play();
          setIsSpeaking(true);
          setIsPaused(false);
          setIsLoading(false);
          return;
        }

        // If no audioBase64 returned, use browser native TTS
        speakNative(text, activeSpeed);
      } catch (_err: any) {
        // Fallback to browser native Web Speech API
        speakNative(text, activeSpeed);
      }
    },
    [cleanupAudio, voice, playbackSpeed, speakNative],
  );

  const pause = useCallback(() => {
    if (usingNativeSpeechRef.current && window.speechSynthesis) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      return;
    }

    if (audioElementRef.current && !audioElementRef.current.paused) {
      audioElementRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (usingNativeSpeechRef.current && window.speechSynthesis) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    if (audioElementRef.current && audioElementRef.current.paused) {
      audioElementRef.current.play().catch(() => {});
      setIsPaused(false);
    }
  }, []);

  const stop = useCallback(() => {
    cleanupAudio();
  }, [cleanupAudio]);

  const replay = useCallback(() => {
    if (lastSpokenTextRef.current) {
      speak(lastSpokenTextRef.current);
    }
  }, [speak]);

  useEffect(() => {
    return () => {
      cleanupAudio();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [cleanupAudio]);

  return {
    isSpeaking,
    isPaused,
    isLoading,
    currentText,
    error,
    speak,
    pause,
    resume,
    stop,
    replay,
    getAnalyserData,
  };
}
