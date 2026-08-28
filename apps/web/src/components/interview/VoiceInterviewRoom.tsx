import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Hand,
  PhoneOff,
  Bot,
  User,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { AudioVisualizer } from './AudioVisualizer';
import { NetworkQualityBadge } from './NetworkQualityBadge';
import { AudioAnswerRecorder } from './AudioAnswerRecorder';
import { useVoiceStreaming } from '../../hooks/useVoiceStreaming';
import { SpeakerRole } from '@ai-interview/contracts';
import { apiClient } from '../../lib/api-client';

interface VoiceInterviewRoomProps {
  interviewId: string;
  roleName?: string;
  levelName?: string;
  onFinish?: () => void;
  onRestAnswerSubmit?: (text: string) => Promise<void>;
}

export const VoiceInterviewRoom: React.FC<VoiceInterviewRoomProps> = ({
  interviewId,
  roleName = 'Senior Software Engineer',
  levelName = 'SENIOR',
  onFinish,
  onRestAnswerSubmit,
}) => {
  const navigate = useNavigate();
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [hasConsented, setHasConsented] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [isSubmittingConsent, setIsSubmittingConsent] = useState(false);

  const {
    connectionStatus,
    connect,
    disconnect,
    isMuted,
    toggleMute,
    isAiSpeaking,
    isCandidateSpeaking,
    silenceDurationSec,
    isProlongedSilence,
    resetSilenceTimer,
    isFallbackToRest,
    transcripts,
    networkQuality,
    bargeInCount,
    triggerBargeIn,
  } = useVoiceStreaming(interviewId);

  useEffect(() => {
    if (!hasConsented) return;
    connect();
    const timer = setInterval(() => {
      setElapsedSec(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      disconnect();
    };
  }, [interviewId, connect, disconnect, hasConsented]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [transcripts]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    disconnect();
    if (onFinish) {
      onFinish();
    } else {
      navigate('/history');
    }
  };

  const handleFallbackAnswer = async (text: string) => {
    if (onRestAnswerSubmit) {
      await onRestAnswerSubmit(text);
    }
  };

  const handleGrantConsent = async () => {
    setIsSubmittingConsent(true);
    setConsentError(null);
    try {
      await apiClient.post('/voice-gateway/consent', {
        interviewId,
        policyVersion: 'VOICE-PRIVACY-2026.08',
      });
      setHasConsented(true);
    } catch (err: any) {
      setConsentError(err?.message || 'Failed to record voice consent. Please try again.');
    } finally {
      setIsSubmittingConsent(false);
    }
  };

  if (!hasConsented) {
    return (
      <div
        className="max-w-xl mx-auto my-12 bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6"
        data-testid="voice-consent-modal"
      >
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Xác Nhận Quyền Riêng Tư & Xử Lý Giọng Nói
            </h3>
            <p className="text-xs text-slate-500">GDPR / CCPA Explicit Consent Gate (F001)</p>
          </div>
        </div>

        <div className="text-xs text-slate-700 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed">
          <p className="font-semibold text-slate-900">
            Trước khi bắt đầu phiên phỏng vấn thoại trực tiếp, vui lòng xác nhận:
          </p>
          <ul className="list-disc pl-4 space-y-1.5 text-slate-600">
            <li>
              Âm thanh micro sẽ được truyền trực tiếp (live stream) qua kết nối mã hóa WSS đến máy
              chủ.
            </li>
            <li>
              Dịch vụ nhận diện (Deepgram STT) và tổng hợp giọng nói (ElevenLabs TTS) xử lý âm thanh
              trong thời gian thực.
            </li>
            <li>
              Hệ thống <strong>KHÔNG</strong> lưu trữ vĩnh viễn file âm thanh gốc (Zero Raw Audio
              Retention).
            </li>
            <li>
              Biên bản văn bản (Transcript) được lưu trữ tối đa 30 ngày theo chính sách Data
              Retention.
            </li>
            <li>Bạn có thể dừng thu âm, tắt micro hoặc kết thúc phiên phỏng vấn bất kỳ lúc nào.</li>
          </ul>
        </div>

        {consentError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{consentError}</span>
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 pt-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => navigate(-1)}
            disabled={isSubmittingConsent}
          >
            Hủy Bỏ
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleGrantConsent}
            disabled={isSubmittingConsent}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200"
          >
            {isSubmittingConsent ? 'Đang kích hoạt...' : 'Tôi Đồng Ý & Bắt Đầu Phỏng Vấn'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6" data-testid="voice-interview-room">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <Mic className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <span>Live Voice Interview</span>
              <Badge variant="default" className="text-[10px] uppercase">
                {roleName} ({levelName})
              </Badge>
            </h2>
            <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5">
              <span>
                Thời lượng:{' '}
                <strong className="text-slate-800 font-mono">{formatTime(elapsedSec)}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'LIVE'
                      ? 'bg-emerald-500 animate-ping'
                      : connectionStatus === 'ERROR'
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                  }`}
                />
                <span
                  className={`font-semibold ${
                    connectionStatus === 'LIVE'
                      ? 'text-emerald-700'
                      : connectionStatus === 'ERROR'
                        ? 'text-rose-700'
                        : 'text-amber-700'
                  }`}
                >
                  {connectionStatus}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <NetworkQualityBadge quality={networkQuality} />
          {bargeInCount > 0 && (
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
              {bargeInCount} lần ngắt lời (Barge-in)
            </span>
          )}
        </div>
      </div>

      {/* Prolonged Silence Warning Prompt (>15s) */}
      {isProlongedSilence && (
        <div
          data-testid="voice-silence-hint"
          className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in-50 duration-200"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">💡</span>
            <div>
              <p className="text-xs font-semibold text-amber-900">
                Phát hiện im lặng kéo dài ({silenceDurationSec}s)
              </p>
              <p className="text-xs text-amber-800">
                AI Interviewer đang lắng nghe. Bạn có thể tiếp tục phát biểu câu trả lời hoặc ngắt
                lời AI khi sẵn sàng.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={resetSilenceTimer}
            className="text-xs shrink-0 bg-white"
          >
            Đã hiểu
          </Button>
        </div>
      )}

      {/* Fail-Closed & Fallback to REST Audio Upload on Error */}
      {(isFallbackToRest || connectionStatus === 'ERROR') && (
        <div
          data-testid="voice-fallback-banner"
          className="p-5 bg-rose-50 border border-rose-200 rounded-2xl space-y-4 animate-in fade-in-50 duration-200"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-rose-900">
                Kết nối Voice WebSocket bị gián đoạn — Kích hoạt chế độ REST Fallback
              </h4>
              <p className="text-xs text-rose-700 leading-relaxed">
                Hệ thống tự động kích hoạt bộ ghi âm REST Audio Upload dự phòng để đảm bảo bạn không
                bị mất dữ liệu câu trả lời dở dang. Bạn có thể ghi âm câu trả lời bên dưới:
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm">
            <AudioAnswerRecorder sessionId={interviewId} onAnswerReady={handleFallbackAnswer} />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={connect}
              className="gap-1.5 text-xs text-rose-800 border-rose-300 hover:bg-rose-100"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử kết nối lại Voice Stream</span>
            </Button>
          </div>
        </div>
      )}

      {/* Voice Avatars Stage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* AI Interviewer Persona Card */}
        <div
          className={`p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center space-y-3 bg-white shadow-sm ${
            isAiSpeaking ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200'
          }`}
        >
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              isAiSpeaking
                ? 'bg-emerald-600 text-white scale-105 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Bot className="w-10 h-10" />
          </div>

          <div className="text-center">
            <h4 className="font-bold text-sm text-slate-900">AI Technical Interviewer</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAiSpeaking ? 'Đang nói câu hỏi...' : 'Đang lắng nghe câu trả lời'}
            </p>
          </div>

          <AudioVisualizer isActive={isAiSpeaking} color="#10b981" />
        </div>

        {/* Candidate Audio Card */}
        <div
          className={`p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center space-y-3 bg-white shadow-sm ${
            isCandidateSpeaking && !isMuted
              ? 'border-sky-500 ring-4 ring-sky-500/10'
              : 'border-slate-200'
          }`}
        >
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? 'bg-rose-100 text-rose-600'
                : isCandidateSpeaking
                  ? 'bg-sky-600 text-white scale-105 shadow-lg shadow-sky-500/20'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            {isMuted ? <MicOff className="w-10 h-10" /> : <User className="w-10 h-10" />}
          </div>

          <div className="text-center">
            <h4 className="font-bold text-sm text-slate-900">Ứng viên (Bạn)</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {isMuted
                ? 'Microphone đang tắt'
                : isCandidateSpeaking
                  ? 'Microphone đang thu âm...'
                  : 'Sẵn sàng phát biểu'}
            </p>
          </div>

          <AudioVisualizer isActive={isCandidateSpeaking && !isMuted} color="#0284c7" />
        </div>
      </div>

      {/* Live Rolling Transcript Feed */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Biên bản ghi âm thời gian thực (Live Transcript)</span>
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {transcripts.length} đoạn hội thoại
          </span>
        </div>

        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label="Biên bản hội thoại phỏng vấn trực tiếp"
          className="max-h-60 overflow-y-auto space-y-3 p-2"
        >
          {transcripts.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">
              AI Interviewer đang chuẩn bị câu hỏi đầu tiên...
            </p>
          ) : (
            transcripts.map((t, idx) => {
              const isAi = t.speaker === SpeakerRole.AI || t.speaker === ('AI' as any);
              return (
                <div
                  key={idx}
                  className={`flex items-start space-x-2.5 ${isAi ? 'justify-start' : 'justify-end'}`}
                >
                  {isAi && (
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-bold">
                      AI
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] p-3 rounded-xl text-xs leading-relaxed ${
                      isAi
                        ? 'bg-slate-50 border border-slate-200 text-slate-800'
                        : 'bg-sky-600 text-white'
                    }`}
                  >
                    <p>{t.text}</p>
                  </div>

                  {!isAi && (
                    <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 text-xs font-bold">
                      You
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* Action Control Bar */}
      <div className="bg-slate-900 rounded-2xl p-4 flex items-center justify-between text-white shadow-xl">
        <div className="flex items-center space-x-3">
          <Button
            type="button"
            variant={isMuted ? 'danger' : 'secondary'}
            size="md"
            onClick={toggleMute}
            className="rounded-xl"
          >
            {isMuted ? <MicOff className="w-4 h-4 mr-1.5" /> : <Mic className="w-4 h-4 mr-1.5" />}
            <span>{isMuted ? 'Bật Micro' : 'Tắt Micro'}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={triggerBargeIn}
            disabled={!isAiSpeaking}
            className="rounded-xl text-amber-300 border-amber-500/40 hover:bg-amber-950/40"
          >
            <Hand className="w-4 h-4 mr-1.5" />
            <span>Ngắt lời AI (Barge-in)</span>
          </Button>
        </div>

        <Button
          type="button"
          variant="danger"
          size="md"
          onClick={handleEndCall}
          className="rounded-xl bg-rose-600 hover:bg-rose-700"
        >
          <PhoneOff className="w-4 h-4 mr-1.5" />
          <span>Kết thúc Phỏng vấn</span>
        </Button>
      </div>
    </div>
  );
};
