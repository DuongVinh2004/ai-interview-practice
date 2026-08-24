import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Hand, PhoneOff, Bot, User, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { AudioVisualizer } from './AudioVisualizer';
import { NetworkQualityBadge } from './NetworkQualityBadge';
import { useVoiceStreaming } from '../../hooks/useVoiceStreaming';
import { SpeakerRole } from '@ai-interview/contracts';

interface VoiceInterviewRoomProps {
  interviewId: string;
  roleName?: string;
  levelName?: string;
  onFinish?: () => void;
}

export const VoiceInterviewRoom: React.FC<VoiceInterviewRoomProps> = ({
  interviewId,
  roleName = 'Senior Software Engineer',
  levelName = 'SENIOR',
  onFinish,
}) => {
  const navigate = useNavigate();
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const {
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
  } = useVoiceStreaming(interviewId);

  useEffect(() => {
    connect();
    const timer = setInterval(() => {
      setElapsedSec(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      disconnect();
    };
  }, [interviewId]);

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
      navigate(`/interviews/${interviewId}/result`);
    }
  };

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
              <span>Thời lượng: <strong className="text-slate-800 font-mono">{formatTime(elapsedSec)}</strong></span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-emerald-700 font-semibold">{connectionStatus}</span>
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
              isAiSpeaking ? 'bg-emerald-600 text-white scale-105 shadow-lg shadow-emerald-500/20' : 'bg-slate-100 text-slate-500'
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
            isCandidateSpeaking && !isMuted ? 'border-sky-500 ring-4 ring-sky-500/10' : 'border-slate-200'
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
              {isMuted ? 'Microphone đang tắt' : isCandidateSpeaking ? 'Microphone đang thu âm...' : 'Sẵn sàng phát biểu'}
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
          <span className="text-[11px] text-slate-400 font-mono">{transcripts.length} đoạn hội thoại</span>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-3 p-2">
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
