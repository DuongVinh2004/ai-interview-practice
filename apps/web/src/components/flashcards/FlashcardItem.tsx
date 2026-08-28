import React, { useState } from 'react';
import { RefreshCw, BookOpen, Code, HelpCircle } from 'lucide-react';
import { CardType } from '@ai-interview/contracts';
import { useI18nStore } from '../../stores/i18n.store';

interface FlashcardItemProps {
  front: string;
  back: string;
  type?: CardType;
  isFlipped?: boolean;
  onFlip?: () => void;
}

export const FlashcardItem: React.FC<FlashcardItemProps> = ({
  front,
  back,
  type = CardType.CONCEPT,
  isFlipped: controlledFlipped,
  onFlip,
}) => {
  const { language } = useI18nStore();
  const isVi = language === 'vi';
  const [internalFlipped, setInternalFlipped] = useState(false);
  const isFlipped = controlledFlipped !== undefined ? controlledFlipped : internalFlipped;

  const handleFlip = () => {
    if (onFlip) {
      onFlip();
    } else {
      setInternalFlipped(!internalFlipped);
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case CardType.CODE_SNIPPET:
        return <Code className="w-3.5 h-3.5 text-sky-600" />;
      case CardType.SCENARIO:
        return <HelpCircle className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <BookOpen className="w-3.5 h-3.5 text-emerald-600" />;
    }
  };

  return (
    <div
      onClick={handleFlip}
      data-testid="flashcard-item"
      className="relative w-full min-h-[280px] sm:min-h-[320px] bg-white rounded-2xl border-2 border-slate-200 hover:border-slate-300 shadow-md hover:shadow-lg p-6 sm:p-8 flex flex-col justify-between cursor-pointer transition-all duration-300 select-none group"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
          {getTypeIcon()}
          <span>{type}</span>
        </div>

        <div className="flex items-center space-x-1.5 text-xs text-slate-400 group-hover:text-primary-600 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>
            {isFlipped
              ? isVi
                ? 'Mặt sau (Đáp án)'
                : 'Back (Answer)'
              : isVi
                ? 'Mặt trước (Câu hỏi)'
                : 'Front (Question)'}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="py-6 flex-1 flex flex-col justify-center">
        {!isFlipped ? (
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary-600">
              {isVi ? 'Câu Hỏi / Đề Bài:' : 'Question / Prompt:'}
            </span>
            <div className="text-base sm:text-lg font-medium text-slate-900 whitespace-pre-wrap leading-relaxed">
              {front}
            </div>
          </div>
        ) : (
          <div className="space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              {isVi ? 'Đáp Án Cốt Lõi / Nguyên Lý:' : 'Key Answer / Invariant:'}
            </span>
            <div className="text-sm sm:text-base font-normal text-slate-800 whitespace-pre-wrap leading-relaxed bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
              {back}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Hint */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <span>
          {isVi ? 'Bấm vào thẻ hoặc nhấn ' : 'Click card or press '}
          <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300 font-mono text-[10px]">
            Space
          </kbd>{' '}
          {isVi ? 'để lật' : 'to flip'}
        </span>
        <span className="text-[11px] font-semibold text-slate-500">
          {isFlipped ? (isVi ? 'Đã lật' : 'Flipped') : isVi ? 'Chưa lật' : 'Unflipped'}
        </span>
      </div>
    </div>
  );
};
