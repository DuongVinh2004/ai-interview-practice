import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { CopilotHintsResponseDto, CopilotHintDto } from '@ai-interview/contracts';
import { Sparkles, HelpCircle, CheckCircle, RefreshCw, Send, Zap } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useI18nStore } from '../../../stores/i18n.store';

interface AiCoPilotHintPanelProps {
  sessionId: string;
  onSelectHint?: (hintText: string) => void;
}

export const AiCoPilotHintPanel: React.FC<AiCoPilotHintPanelProps> = ({
  sessionId,
  onSelectHint,
}) => {
  const { language } = useI18nStore();
  const isVi = language === 'vi';
  const [usedHints, setUsedHints] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch, isFetching } = useQuery<CopilotHintsResponseDto>({
    queryKey: ['copilot-hints', sessionId],
    queryFn: async () => {
      const res = await apiClient.get<CopilotHintsResponseDto>(
        `/sessions/${sessionId}/copilot-hints`,
      );
      return res.data;
    },
    refetchInterval: 15000, // Real-time poll every 15s
  });

  const handleUseHint = (hint: CopilotHintDto) => {
    setUsedHints(prev => new Set([...prev, hint.id]));
    if (onSelectHint) {
      onSelectHint(hint.questionText);
    }
  };

  const getDifficultyBadge = (diff: 'EASY' | 'MEDIUM' | 'HARD') => {
    switch (diff) {
      case 'HARD':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'EASY':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col h-full overflow-hidden"
      data-testid="copilot-hint-panel"
    >
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
            <Sparkles className="h-4 w-4 text-amber-300" />
          </div>
          <div>
            <h3 className="font-bold text-sm">AI Mentor Co-Pilot</h3>
            <p className="text-[11px] text-emerald-100">
              {isVi ? 'Gợi ý câu hỏi đào sâu trực tiếp' : 'Live probing questions feed'}
            </p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors"
          title={isVi ? 'Làm mới gợi ý' : 'Refresh Suggestions'}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Active Topic Banner */}
      {data?.currentTurnTopic && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center gap-1.5 text-xs text-slate-600">
          <Zap className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          <span className="font-medium">{isVi ? 'Chủ đề hiện tại:' : 'Active Focus:'}</span>
          <span className="font-semibold text-slate-800 truncate">{data.currentTurnTopic}</span>
        </div>
      )}

      {/* Hint List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 divide-y divide-slate-100">
        {isLoading && !data ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : data?.hints && data.hints.length > 0 ? (
          data.hints.map(hint => {
            const isUsed = usedHints.has(hint.id);
            return (
              <div
                key={hint.id}
                className={`pt-3 first:pt-0 transition-all ${
                  isUsed ? 'opacity-60 bg-slate-50/60 p-3 rounded-xl' : ''
                }`}
                data-testid="copilot-hint-item"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getDifficultyBadge(
                        hint.difficulty,
                      )}`}
                    >
                      {hint.difficulty}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">{hint.topic}</span>
                  </div>
                  {isUsed && (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> {isVi ? 'Đã hỏi' : 'Asked'}
                    </span>
                  )}
                </div>

                <p className="text-sm font-semibold text-slate-800 leading-snug">
                  "{hint.questionText}"
                </p>

                <p className="text-xs text-slate-500 mt-1 italic">
                  {isVi ? 'Mục đích:' : 'Intent:'} {hint.intentDescription}
                </p>

                {/* Key Signals */}
                {hint.expectedKeySignals && hint.expectedKeySignals.length > 0 && (
                  <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200/60 text-[11px]">
                    <span className="font-bold text-slate-700 block mb-1">
                      {isVi
                        ? 'Các tín hiệu kỹ thuật cần lắng nghe:'
                        : 'Expected Signals to listen for:'}
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                      {hint.expectedKeySignals.map((signal, idx) => (
                        <li key={idx}>{signal}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <Button
                    variant={isUsed ? 'ghost' : 'outline'}
                    size="sm"
                    onClick={() => handleUseHint(hint)}
                    className="gap-1.5 text-xs py-1"
                    data-testid="use-hint-btn"
                  >
                    <Send className="h-3 w-3" />
                    <span>
                      {isUsed
                        ? isVi
                          ? 'Hỏi lại'
                          : 'Ask Again'
                        : isVi
                          ? 'Sử dụng câu hỏi này'
                          : 'Use Question'}
                    </span>
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            <HelpCircle className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            {isVi
              ? 'Chưa có gợi ý đào sâu nào. Gợi ý sẽ tự động cập nhật trong quá trình phỏng vấn.'
              : 'No probing hints generated yet. Hints update as the interview progresses.'}
          </div>
        )}
      </div>
    </div>
  );
};
