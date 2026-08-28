import React, { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { CardType } from '@ai-interview/contracts';
import { useI18nStore } from '../../stores/i18n.store';

interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  deckId: string;
  onCreateCard: (data: {
    deckId: string;
    type: CardType;
    frontContent: string;
    backContent: string;
  }) => Promise<any>;
  isSubmitting: boolean;
}

export const CreateCardModal: React.FC<CreateCardModalProps> = ({
  isOpen,
  onClose,
  deckId,
  onCreateCard,
  isSubmitting,
}) => {
  const { language } = useI18nStore();
  const isVi = language === 'vi';
  const [type, setType] = useState<CardType>(CardType.CONCEPT);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) {
      setError(
        isVi
          ? 'Vui lòng điền đầy đủ cả 2 mặt của thẻ.'
          : 'Please fill in both sides of the flashcard.',
      );
      return;
    }
    setError(null);
    try {
      await onCreateCard({ deckId, type, frontContent: front.trim(), backContent: back.trim() });
      setFront('');
      setBack('');
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          (isVi ? 'Không thể tạo flashcard' : 'Failed to create flashcard'),
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      data-testid="create-card-modal"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <Plus className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-base text-slate-900">
              {isVi ? 'Thêm Flashcard Mới' : 'Add New Flashcard'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isVi ? 'Loại thẻ' : 'Card Type'}
            </label>
            <select
              value={type}
              onChange={e => setType(e.target.value as CardType)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value={CardType.CONCEPT}>
                {isVi ? 'Khái niệm (CONCEPT)' : 'Concept (CONCEPT)'}
              </option>
              <option value={CardType.CODE_SNIPPET}>
                {isVi ? 'Đoạn mã (CODE_SNIPPET)' : 'Code Snippet (CODE_SNIPPET)'}
              </option>
              <option value={CardType.SCENARIO}>
                {isVi ? 'Tình huống (SCENARIO)' : 'Scenario (SCENARIO)'}
              </option>
              <option value={CardType.MCQ}>
                {isVi ? 'Trắc nghiệm (MCQ)' : 'Multiple Choice (MCQ)'}
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isVi ? 'Mặt trước (Câu hỏi / Đề bài)' : 'Front (Question / Prompt)'}
            </label>
            <textarea
              value={front}
              onChange={e => setFront(e.target.value)}
              rows={3}
              placeholder={
                isVi
                  ? 'VD: Điều gì xảy ra khi một Node.js event loop gặp synchronous blocking CPU task?'
                  : 'e.g. What happens when Node.js event loop encounters a synchronous CPU-bound task?'
              }
              className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isVi ? 'Mặt sau (Đáp án / Nguyên lý cốt lõi)' : 'Back (Key Invariant / Answer)'}
            </label>
            <textarea
              value={back}
              onChange={e => setBack(e.target.value)}
              rows={4}
              placeholder={
                isVi
                  ? 'VD: Toàn bộ single-threaded event loop bị block, không thể xử lý các I/O callback khác. Giải pháp: Sử dụng Worker Threads hoặc delegate sang background microservice.'
                  : 'e.g. The single-threaded event loop blocks, stalling all other I/O callbacks. Solution: Worker threads or background queue.'
              }
              className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {isVi ? 'Hủy' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting || !front.trim() || !back.trim()}
            >
              {isVi ? 'Tạo Flashcard' : 'Create Flashcard'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
