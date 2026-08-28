import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioRecorder, MAX_AUDIO_DURATION_SECONDS } from '../../hooks/use-audio-recorder';
import { useAudioSettingsStore } from '../../stores/audio-settings.store';
import { useI18nStore } from '../../stores/i18n.store';
import { apiClient, ApiError } from '../../lib/api-client';
import { TranscribeAudioResponse } from '@ai-interview/contracts';
import { AudioVisualizer } from './AudioVisualizer';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Alert } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';
import {
  Mic,
  Square,
  RotateCcw,
  Send,
  Radio,
  Keyboard,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit3,
} from 'lucide-react';

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
    remainingDuration,
    isNearMaxDuration,
    audioLevel,
    silenceDuration,
    isProlongedSilence,
    resetSilenceTimer,
    error: recorderError,
    startRecording,
    stopRecording,
    resetRecording,
    getAnalyserData,
  } = useAudioRecorder({ maxDuration: MAX_AUDIO_DURATION_SECONDS });

  const { pushToTalk } = useAudioSettingsStore();
  const { t, language } = useI18nStore();

  const [transcribedText, setTranscribedText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [isFallbackNotice, setIsFallbackNotice] = useState(false);
  const [savedAudioBlob, setSavedAudioBlob] = useState<Blob | null>(null);

  const isSpaceKeyDownRef = useRef(false);

  // Handle transcription
  const handleTranscribe = useCallback(
    async (blob: Blob) => {
      setIsTranscribing(true);
      setTranscribeError(null);
      setSavedAudioBlob(blob);

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
          setIsFallbackNotice(
            Boolean((response as any).isFallback || response.provider === 'mock'),
          );
          setHasRecorded(true);
        } else {
          setTranscribeError('No speech detected in audio recording. Please try speaking clearly.');
        }
      } catch (err: any) {
        if (err instanceof ApiError) {
          setTranscribeError(err.message);
        } else {
          setTranscribeError(
            'Failed to transcribe audio. You can retry upload or type your answer manually.',
          );
        }
      } finally {
        setIsTranscribing(false);
      }
    },
    [language, sessionId],
  );

  // Auto-stop when reaching duration cap (5 minutes = 300s)
  useEffect(() => {
    if (isRecording && recordingDuration >= MAX_AUDIO_DURATION_SECONDS) {
      stopRecording().then(blob => {
        if (blob) {
          setSavedAudioBlob(blob);
          handleTranscribe(blob);
        }
      });
    }
  }, [isRecording, recordingDuration, stopRecording, handleTranscribe]);

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
              if (blob) {
                setSavedAudioBlob(blob);
                handleTranscribe(blob);
              }
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
            if (blob) {
              setSavedAudioBlob(blob);
              handleTranscribe(blob);
            }
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
        setSavedAudioBlob(blob);
        await handleTranscribe(blob);
      }
    } else {
      setTranscribedText('');
      setHasRecorded(false);
      setTranscribeError(null);
      setSavedAudioBlob(null);
      await startRecording();
    }
  };

  const handleRetryUpload = async () => {
    if (savedAudioBlob) {
      await handleTranscribe(savedAudioBlob);
    }
  };

  const handleManualTypeFallback = () => {
    setTranscribeError(null);
    setHasRecorded(true);
    if (!transcribedText) {
      setTranscribedText('');
    }
  };

  const handleReRecord = () => {
    resetRecording();
    setTranscribedText('');
    setHasRecorded(false);
    setTranscribeError(null);
    setIsFallbackNotice(false);
    setSavedAudioBlob(null);
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
        <div className="flex flex-wrap items-center justify-between gap-3">
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

          <div className="flex items-center gap-2">
            {/* Audio Duration Warning Badge (< 30s remaining) */}
            {isRecording && isNearMaxDuration && (
              <div
                data-testid="duration-warning-badge"
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-300 rounded-full text-xs font-bold text-amber-800 animate-pulse"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span>Còn {remainingDuration}s (Tối đa 5:00)</span>
              </div>
            )}

            {/* Recording Duration Timer Badge */}
            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-full">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                <span className="text-xs font-bold text-rose-700 font-mono">
                  {formatSeconds(recordingDuration)} / 05:00
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Prolonged Silence (>15s) Detection Suggestion Prompt */}
        {isRecording && isProlongedSilence && (
          <div
            data-testid="silence-prompt-alert"
            className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in-50 duration-200"
          >
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">💡</span>
              <p className="font-medium">
                Phát hiện im lặng kéo dài ({silenceDuration}s). Bạn có muốn tiếp tục trả lời hay
                hoàn tất ghi âm để nộp bài?
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={resetSilenceTimer}
                className="text-xs py-1 px-2.5"
              >
                Tiếp tục nói
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={handleToggleRecord}
                className="text-xs py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Hoàn tất ghi âm
              </Button>
            </div>
          </div>
        )}

        {/* Real-time Waveform Canvas */}
        <div
          role="region"
          aria-label="Biểu đồ sóng âm thanh trực tiếp"
          className="bg-slate-900 p-4 rounded-xl shadow-inner border border-slate-800 flex flex-col items-center justify-center gap-2"
        >
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
              aria-label={
                isRecording
                  ? t.audio?.stopRecording || 'Dừng ghi âm câu trả lời'
                  : t.audio?.startRecording || 'Bắt đầu ghi âm câu trả lời'
              }
              aria-pressed={isRecording}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-md transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500 ${
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

        {/* Error Messages & State Recovery Actions */}
        {recorderError && (
          <Alert variant="error">
            {recorderError === 'MICROPHONE_PERMISSION_DENIED'
              ? t.audio?.micPermissionDenied || 'Microphone permission was denied.'
              : recorderError === 'MICROPHONE_NOT_FOUND'
                ? t.audio?.micNotFound || 'No microphone detected.'
                : recorderError}
          </Alert>
        )}

        {transcribeError && (
          <div className="space-y-3">
            <Alert variant="error">{transcribeError}</Alert>

            {/* State Recovery Action Bar */}
            {savedAudioBlob && (
              <div
                data-testid="state-recovery-bar"
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span className="text-slate-600 font-medium">
                  Bản ghi âm vẫn được lưu tại client. Bạn có thể thử gửi lại mà không cần nói lại:
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={handleRetryUpload}
                    disabled={isTranscribing}
                    className="gap-1.5"
                    data-testid="retry-upload-btn"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isTranscribing ? 'animate-spin' : ''}`} />
                    <span>Thử lại (Retry Upload)</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleManualTypeFallback}
                    className="gap-1.5"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Nhập thủ công</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
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

          {isFallbackNotice && (
            <div
              data-testid="audio-fallback-notice"
              className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5"
            >
              <span className="text-base leading-none">⚠️</span>
              <div className="space-y-0.5">
                <p className="font-semibold text-amber-900">
                  Lưu ý: Hệ thống đang sử dụng bản ghi âm phiên âm dự phòng (Fallback Mode)
                </p>
                <p className="text-amber-800 leading-relaxed">
                  Dịch vụ nhận diện giọng nói tự động đã kích hoạt cơ chế dự phòng do kết nối mạng
                  hoặc nhà cung cấp. Vui lòng kiểm tra và chỉnh sửa câu trả lời của bạn dưới đây
                  trước khi gửi nộp.
                </p>
              </div>
            </div>
          )}

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
