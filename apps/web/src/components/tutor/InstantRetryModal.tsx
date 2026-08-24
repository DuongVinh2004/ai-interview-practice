import React, { useState } from 'react';
import { X, RotateCcw, TrendingUp, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { QuestionRetryResponse } from '@ai-interview/contracts';

interface InstantRetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  interviewId?: string;
  turnNumber: number;
  questionContent: string;
  originalAnswer: string;
  originalScore: number;
  onSubmitRetry: (retryAnswer: string) => Promise<QuestionRetryResponse>;
  isSubmitting: boolean;
}

export const InstantRetryModal: React.FC<InstantRetryModalProps> = ({
  isOpen,
  onClose,
  turnNumber,
  questionContent,
  originalAnswer,
  originalScore,
  onSubmitRetry,
  isSubmitting,
}) => {
  const [retryText, setRetryText] = useState('');
  const [retryResult, setRetryResult] = useState<QuestionRetryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (retryText.trim().length < 10) {
      setError('Vui lòng nhập ít nhất 10 ký tự câu trả lời.');
      return;
    }
    setError(null);
    try {
      const res = await onSubmitRetry(retryText);
      setRetryResult(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Không thể chấm điểm câu trả lời');
    }
  };

  const handleReset = () => {
    setRetryText('');
    setRetryResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150" data-testid="instant-retry-modal">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900">
              Luyện tập lại Câu hỏi #{turnNumber} (Instant Retry)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Question Box */}
          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1">
            <span className="text-[11px] font-bold uppercase text-indigo-700">Câu hỏi phỏng vấn:</span>
            <p className="text-sm font-medium text-indigo-950">{questionContent}</p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!retryResult ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Original Answer Reference */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Câu trả lời ban đầu:</span>
                  <span className="font-semibold text-slate-700">Điểm: {originalScore}/10</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-200 italic max-h-24 overflow-y-auto">
                  "{originalAnswer}"
                </div>
              </div>

              {/* Retry Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Nhập câu trả lời mới đã cải thiện (Áp dụng gợi ý từ AI Tutor):
                </label>
                <textarea
                  value={retryText}
                  onChange={e => setRetryText(e.target.value)}
                  rows={6}
                  placeholder="Gõ chi tiết câu trả lời mới, bổ sung các trường hợp biên, kiến trúc và giải pháp tối ưu..."
                  className="w-full text-xs font-mono p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Hủy
                </Button>
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  disabled={isSubmitting || retryText.trim().length < 10}
                >
                  <span>Chấm điểm câu trả lời mới</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              {/* Score Improvement Banner */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-emerald-800">Điểm số sau khi cải thiện</p>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl font-extrabold text-emerald-950">{retryResult.retryScore}/10</span>
                      <span className="text-xs font-bold text-emerald-700">
                        (+{retryResult.improvement} điểm so với lần 1)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-emerald-800 font-medium">
                  Lần 1: {retryResult.originalScore} ➔ Lần 2: {retryResult.retryScore}
                </div>
              </div>

              {/* Side-by-side Answer View */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">Lần 1 ({retryResult.originalScore}/10):</span>
                  <p className="text-xs text-slate-600 line-clamp-4">{retryResult.originalAnswer}</p>
                </div>
                <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-emerald-700 block">Lần 2 ({retryResult.retryScore}/10):</span>
                  <p className="text-xs text-slate-800 line-clamp-4 font-medium">{retryResult.retryAnswer}</p>
                </div>
              </div>

              {/* Feedback Summary */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Đánh giá sự tiến bộ:</span>
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">{retryResult.feedback.summary}</p>

                {retryResult.feedback.keyStrengths.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-emerald-700">Điểm cải thiện nổi bật:</span>
                    <ul className="text-xs text-slate-600 list-disc list-inside space-y-0.5">
                      {retryResult.feedback.keyStrengths.map((st, i) => (
                        <li key={i}>{st}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                  Thử lại lần nữa
                </Button>
                <Button type="button" onClick={onClose}>
                  Hoàn tất
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
