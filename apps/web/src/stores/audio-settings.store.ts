import { create } from 'zustand';
import { AudioVoice, InterviewMode } from '@ai-interview/contracts';

interface AudioSettingsState {
  mode: InterviewMode;
  voice: AudioVoice;
  playbackSpeed: number;
  autoPlayTts: boolean;
  micSensitivity: number;
  pushToTalk: boolean;
  setMode: (mode: InterviewMode) => void;
  setVoice: (voice: AudioVoice) => void;
  setPlaybackSpeed: (speed: number) => void;
  setAutoPlayTts: (autoPlay: boolean) => void;
  setMicSensitivity: (sensitivity: number) => void;
  setPushToTalk: (pushToTalk: boolean) => void;
  toggleMode: () => void;
}

const STORAGE_KEY = 'ai_interview_audio_settings';

function loadSavedSettings() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistSettings(settings: Partial<AudioSettingsState>) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const existing = loadSavedSettings() || {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...settings }));
  } catch {
    // Ignore storage quota errors
  }
}

export const useAudioSettingsStore = create<AudioSettingsState>((set, get) => {
  const saved = loadSavedSettings();

  return {
    mode: saved?.mode ?? InterviewMode.TEXT,
    voice: saved?.voice ?? AudioVoice.ALLOY,
    playbackSpeed: saved?.playbackSpeed ?? 1.0,
    autoPlayTts: saved?.autoPlayTts ?? true,
    micSensitivity: saved?.micSensitivity ?? 80,
    pushToTalk: saved?.pushToTalk ?? false,

    setMode: (mode: InterviewMode) => {
      persistSettings({ mode });
      set({ mode });
    },
    setVoice: (voice: AudioVoice) => {
      persistSettings({ voice });
      set({ voice });
    },
    setPlaybackSpeed: (playbackSpeed: number) => {
      persistSettings({ playbackSpeed });
      set({ playbackSpeed });
    },
    setAutoPlayTts: (autoPlayTts: boolean) => {
      persistSettings({ autoPlayTts });
      set({ autoPlayTts });
    },
    setMicSensitivity: (micSensitivity: number) => {
      persistSettings({ micSensitivity });
      set({ micSensitivity });
    },
    setPushToTalk: (pushToTalk: boolean) => {
      persistSettings({ pushToTalk });
      set({ pushToTalk });
    },
    toggleMode: () => {
      const current = get().mode;
      const next = current === InterviewMode.VOICE ? InterviewMode.TEXT : InterviewMode.VOICE;
      persistSettings({ mode: next });
      set({ mode: next });
    },
  };
});
