import { useState } from 'react';
import { useAudioSettingsStore } from '../../stores/audio-settings.store';
import { useI18nStore } from '../../stores/i18n.store';
import { AudioVoice, InterviewMode } from '@ai-interview/contracts';
import { Button } from '../ui/Button';
import {
  Mic,
  MessageSquare,
  Volume2,
  Play,
  Pause,
  RotateCcw,
  Settings2,
  Sliders,
  Sparkles,
  Check,
} from 'lucide-react';

interface VoiceModeControlsProps {
  isAiSpeaking?: boolean;
  isAiLoading?: boolean;
  onPlayAiSpeech?: () => void;
  onPauseAiSpeech?: () => void;
  onReplayAiSpeech?: () => void;
}

export function VoiceModeControls({
  isAiSpeaking = false,
  isAiLoading = false,
  onPlayAiSpeech,
  onPauseAiSpeech,
  onReplayAiSpeech,
}: VoiceModeControlsProps) {
  const {
    mode,
    voice,
    playbackSpeed,
    autoPlayTts,
    micSensitivity,
    pushToTalk,
    setMode,
    setVoice,
    setPlaybackSpeed,
    setAutoPlayTts,
    setMicSensitivity,
    setPushToTalk,
  } = useAudioSettingsStore();

  const { t } = useI18nStore();
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const voices: { id: AudioVoice; name: string; desc: string }[] = [
    { id: AudioVoice.ALLOY, name: 'Alloy', desc: 'Neutral, balanced & versatile' },
    { id: AudioVoice.ECHO, name: 'Echo', desc: 'Warm & clear male voice' },
    { id: AudioVoice.FABLE, name: 'Fable', desc: 'British accent, expressive' },
    { id: AudioVoice.ONYX, name: 'Onyx', desc: 'Deep, authoritative tone' },
    { id: AudioVoice.NOVA, name: 'Nova', desc: 'Energetic, friendly female voice' },
    { id: AudioVoice.SHIMMER, name: 'Shimmer', desc: 'Gentle, soothing tone' },
  ];

  const speeds = [0.8, 1.0, 1.2, 1.5];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
      {/* Mode Switcher Toggle */}
      <div className="flex items-center gap-2">
        <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setMode(InterviewMode.TEXT)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mode === InterviewMode.TEXT
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            data-testid="mode-text-btn"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{t.audio?.textMode || 'Text Mode'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMode(InterviewMode.VOICE)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mode === InterviewMode.VOICE
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            data-testid="mode-voice-btn"
          >
            <Mic className="h-3.5 w-3.5" />
            <span>{t.audio?.voiceMode || 'Voice Mode'}</span>
          </button>
        </div>

        {mode === InterviewMode.VOICE && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium border border-emerald-200">
            <Sparkles className="h-3 w-3" />
            <span>STT & TTS Active</span>
          </span>
        )}
      </div>

      {/* AI Speech Player Controls & Audio Settings Button */}
      <div className="flex items-center gap-2">
        {mode === InterviewMode.VOICE && (
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <span className="text-xs font-medium text-slate-600 mr-1 flex items-center gap-1">
              <Volume2 className="h-3.5 w-3.5 text-indigo-600" />
              <span className="hidden md:inline">{t.audio?.aiVoice || 'AI Voice'}:</span>
            </span>

            {isAiSpeaking ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onPauseAiSpeech}
                className="h-7 px-2 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                title={t.audio?.pauseAudio || 'Pause'}
              >
                <Pause className="h-3 w-3 fill-current" />
                <span className="hidden sm:inline">{t.audio?.pauseAudio || 'Pause'}</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onPlayAiSpeech}
                isLoading={isAiLoading}
                className="h-7 px-2 text-xs gap-1 border-slate-300 hover:bg-slate-100"
                title={t.audio?.playQuestion || 'Play'}
              >
                <Play className="h-3 w-3 fill-current" />
                <span className="hidden sm:inline">{t.audio?.playQuestion || 'Play'}</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onReplayAiSpeech}
              className="h-7 w-7 p-0 border-slate-200 text-slate-600 hover:bg-slate-100"
              title={t.audio?.replayAudio || 'Replay'}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Audio Settings Trigger */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettingsModal(true)}
          className="h-8 px-2.5 gap-1.5 text-xs text-slate-700 hover:bg-slate-100"
          title={t.audio?.audioSettings || 'Audio Settings'}
          data-testid="audio-settings-btn"
        >
          <Settings2 className="h-3.5 w-3.5 text-slate-500" />
          <span className="hidden md:inline">{t.audio?.audioSettings || 'Settings'}</span>
        </Button>
      </div>

      {/* Audio Settings Dialog / Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {t.audio?.audioSettings || 'Audio & Voice Settings'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* AI Voice Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                {t.audio?.voiceSelect || 'AI Interviewer Voice'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {voices.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVoice(v.id)}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all flex flex-col justify-between ${
                      voice === v.id
                        ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full font-bold text-slate-900">
                      <span>{v.name}</span>
                      {voice === v.id && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1">{v.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Playback Speed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  {t.audio?.playbackRate || 'Playback Speed'}
                </label>
                <span className="text-xs font-bold text-emerald-700">{playbackSpeed}x</span>
              </div>
              <div className="flex gap-2">
                {speeds.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPlaybackSpeed(s)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      playbackSpeed === s
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-play Question Speech Switch */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  {t.audio?.autoPlayTts || 'Auto-read Question Audio'}
                </span>
                <span className="text-[11px] text-slate-500">
                  Automatically speak new questions when a turn starts
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoPlayTts}
                onChange={e => setAutoPlayTts(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </div>

            {/* Push-to-Talk Switch */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  {t.audio?.pushToTalk || 'Push-to-Talk Mode'}
                </span>
                <span className="text-[11px] text-slate-500">
                  Hold Spacebar to speak instead of click to toggle
                </span>
              </div>
              <input
                type="checkbox"
                checked={pushToTalk}
                onChange={e => setPushToTalk(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </div>

            {/* Mic Sensitivity Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  {t.audio?.micSensitivity || 'Microphone Sensitivity'}
                </label>
                <span className="text-xs text-slate-500">{micSensitivity}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={micSensitivity}
                onChange={e => setMicSensitivity(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowSettingsModal(false)}
                className="px-5"
              >
                {t.interview?.cancel ? 'Done' : 'Xong'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
