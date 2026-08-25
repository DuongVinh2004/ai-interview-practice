import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioRecorder } from '../../hooks/use-audio-recorder';
import { useAudioSettingsStore } from '../../stores/audio-settings.store';
import { useI18nStore } from '../../stores/i18n.store';
import { apiClient, ApiError } from '../../lib/api-client';
import { TranscribeAudioResponse } from '@ai-interview/contracts';
import { AudioVisualizer } from './AudioVisualizer';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Alert } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';
import { Mic, Square, RotateCcw, Send, Radio, Keyboard, CheckCircle2 } from 'lucide-react';

interface AudioAnswerRecorderProps {
  onAnswerReady: (text: string) => Promise<void>;
  isSubmitting?: boolean;
  sessionId?: string;
}

export function AudioAnswerRecorder({
  onAnswerReady,
  isSubmitting = false,
  sessionId,
}: AudioAnswerRecorderProps) {
  const {
    isRecording,
    recordingDuration,
    audioLevel,
    error: recorderError,
    startRecording,
    stopRecording,
    resetRecording,
    getAnalyserData,
  } = useAudioRecorder();

  const { pushToTalk } = useAudioSettingsStore();
  const { t, language } = useI18nStore();

  const [transcribedText, setTranscribedText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [hasRecorded, setHasRecorded] = useState(false);

  const isSpaceKeyDownRef = useRef(false);

  // Handle transcription
  const handleTranscribe = useCallback(
    async (blob: Blob) => {
      setIsTranscribing(true);
      setTranscribeError(null);

      try {
        const formData = new FormData();
        const extension = blob.type.includes('wav') ? 'wav' : 'webm';
        formData.append('file', blob, `answer.${extension}`);

        const url = `/audio/transcribe?language=${language}${sessionId ? `&sessionId=${sessionId}` : ''}`;
        const response = await apiClient<TranscribeAudioResponse>(url, {
          method: 'POST',
          body: formData,
        });

        if (response && response.text) {
          setTranscribedText(response.text);
          setHasRecorded(true);
        } else {
          setTranscribeError('No speech detected in audio recording. Please try speaking clearly.');
        }
      } catch (err: any) {
        if (err instanceof ApiError) {
          setTranscribeError(err.message);
        } else {
          setTranscribeError('Failed to transcribe audio. You can type your answer manually.');
        }
      } finally {
        setIsTranscribing(false);
      }
    },
    [language, sessionId],
  );

  // Push-to-Talk & Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Space if not focused inside an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;

      if (e.code === 'Space' && !e.repeat && !isSpaceKeyDownRef.current) {
        e.preventDefault();
        isSpaceKeyDownRef.current = true;

        if (pushToTalk) {
          if (!isRecording && !isTranscribing && !isSubmitting) {
            startRecording();
          }
        } else {
          // Toggle mode
          if (!isRecording && !isTranscribing && !isSubmitting) {
            startRecording();
          } else if (isRecording) {
            stopRecording().then(blob => {
              if (blob) handleTranscribe(blob);
            });
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        isSpaceKeyDownRef.current = false;

        if (pushToTalk && isRecording) {
          stopRecording().then(blob => {
            if (blob) handleTranscribe(blob);
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    pushToTalk,
    isRecording,
    isTranscribing,
    isSubmitting,
    startRecording,
    stopRecording,
    handleTranscribe,
  ]);

  const handleToggleRecord = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob) {
        await handleTranscribe(blob);
      }
    } else {
      setTranscribedText('');
      setHasRecorded(false);
      setTranscribeError(null);
      await startRecording();
    }
  };

  const handleReRecord = () => {
    resetRecording();
    setTranscribedText('');
    setHasRecorded(false);
    setTranscribeError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcribedText.trim() || isSubmitting) return;
    await onAnswerReady(transcribedText.trim());
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Recording Card & Visualizer */}
      <div className="p-6 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/50 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-xl transition-all ${
                isRecording
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isRecording
                  ? t.audio?.recording || 'Recording Your Answer...'
                  : isTranscribing
                    ? t.audio?.transcribing || 'Transcribing Speech...'
                    : hasRecorded
                      ? 'Transcript Ready'
                      : t.audio?.startRecording || 'Record Your Answer'}
              </h3>
              <p className="text-xs text-slate-500">
                {pushToTalk
                  ? t.audio?.holdSpaceToTalk || 'Hold Spacebar to speak'
                  : t.audio?.pressSpaceToToggle || 'Press Spacebar or Click Mic to Start/Stop'}
              </p>
            </div>
          </div>

          {/* Recording Duration Timer Badge */}
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-full">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
              <span className="text-xs font-bold text-rose-700 font-mono">
                {formatSeconds(recordingDuration)}
              </span>
            </div>
          )}
        </div>

        {/* Real-time Waveform Canvas */}
        <div className="bg-slate-900 p-4 rounded-xl shadow-inner border border-slate-800 flex flex-col items-center justify-center gap-2">
          <AudioVisualizer
            isActive={isRecording}
            getAnalyserData={getAnalyserData}
            mode="wave"
            theme={isRecording ? 'user' : 'idle'}
            height={64}
            className="w-full"
          />

          {isRecording && (
            <div className="w-full flex items-center justify-between text-[11px] text-slate-400 px-2 pt-1 border-t border-slate-800/80">
              <span className="flex items-center gap-1">
                <Radio className="h-3 w-3 text-rose-400 animate-pulse" />
                Live Mic Activity
              </span>
              <span>Level: {audioLevel}%</span>
            </div>
          )}
        </div>

        {/* Record / Stop Action Button Bar */}
        {!hasRecorded && !isTranscribing && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleToggleRecord}
              disabled={isTranscribing || isSubmitting}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-md transition-all ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-700 text-white ring-4 ring-rose-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white ring-4 ring-emerald-100 hover:shadow-lg'
              }`}
              data-testid="record-toggle-btn"
            >
              {isRecording ? (
                <>
                  <Square className="h-4 w-4 fill-current" />
                  <span>{t.audio?.stopRecording || 'Stop Recording'}</span>
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  <span>{t.audio?.startRecording || 'Start Speaking'}</span>
                </>
              )}
            </button>

            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Keyboard className="h-3.5 w-3.5" />
              <span>Space shortcut</span>
            </span>
          </div>
        )}

        {/* Transcribing Spinner */}
        {isTranscribing && (
          <div className="flex items-center justify-center py-6 gap-3 text-emerald-800 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <Spinner size="md" />
            <span className="text-sm font-semibold">
              {t.audio?.transcribing || 'Transcribing your audio with Whisper AI...'}
            </span>
          </div>
        )}

        {/* Error Messages */}
        {recorderError && (
          <Alert variant="error">
            {recorderError === 'MICROPHONE_PERMISSION_DENIED'
              ? t.audio?.micPermissionDenied || 'Microphone permission was denied.'
              : recorderError === 'MICROPHONE_NOT_FOUND'
                ? t.audio?.micNotFound || 'No microphone detected.'
                : recorderError}
          </Alert>
        )}

        {transcribeError && <Alert variant="error">{transcribeError}</Alert>}
      </div>

      {/* Editable Transcribed Text & Submission Form */}
      {hasRecorded && (
        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-2xl border border-emerald-200 bg-white shadow-md space-y-4 animate-in fade-in-50 duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {t.audio?.editTranscribedText || 'Review & Edit Your Transcribed Answer'}
              </h4>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {transcribedText.length} / 5000 chars
            </span>
          </div>

          <Textarea
            id="transcribed-answer"
            value={transcribedText}
            onChange={e => setTranscribedText(e.target.value)}
            rows={6}
            maxChars={5000}
            required
            className="text-sm leading-relaxed"
          />

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReRecord}
              disabled={isSubmitting}
              className="gap-1.5 text-slate-600 hover:text-slate-900"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t.audio?.reRecord || 'Re-record'}</span>
            </Button>

            <Button
              type="submit"
              variant="primary"
              disabled={!transcribedText.trim() || transcribedText.length > 5000 || isSubmitting}
              isLoading={isSubmitting}
              className="gap-2 px-6"
            >
              <Send className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? t.interview?.submitting || 'Submitting...'
                  : t.interview?.submitAnswer || 'Submit Answer'}
              </span>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
