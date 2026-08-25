import { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { CardType } from '@ai-interview/contracts';
import { playSFX } from '../../lib/sfx-engine';
import { Sparkles, RotateCcw, ArrowRight, ArrowLeft } from 'lucide-react';

export interface SwipeCardProps {
  front: string;
  back: string;
  type?: CardType;
  isFlipped: boolean;
  onFlip: () => void;
  onSwipeRight: () => void; // Good / Remembered
  onSwipeLeft: () => void;  // Again / Review
}

export function SwipeCard({
  front,
  back,
  type = CardType.CONCEPT,
  isFlipped,
  onFlip,
  onSwipeRight,
  onSwipeLeft,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.6, 0.9, 1, 0.9, 0.6]);

  const rightIndicatorOpacity = useTransform(x, [20, 120], [0, 1]);
  const leftIndicatorOpacity = useTransform(x, [-20, -120], [0, 1]);

  const [exitX, setExitX] = useState<number | null>(null);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) {
      setExitX(300);
      playSFX('success');
      onSwipeRight();
    } else if (info.offset.x < -100) {
      setExitX(-300);
      playSFX('click');
      onSwipeLeft();
    }
  };

  const handleCardClick = () => {
    playSFX('card_flip');
    onFlip();
  };

  return (
    <div className="relative w-full min-h-[340px] flex items-center justify-center select-none touch-pan-y">
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        style={{ x, rotate, opacity }}
        animate={exitX !== null ? { x: exitX, opacity: 0 } : { x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        onClick={handleCardClick}
        className="w-full cursor-grab active:cursor-grabbing bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 min-h-[340px] flex flex-col justify-between relative overflow-hidden"
        data-testid="swipe-card"
      >
        {/* Swipe Indicators */}
        <motion.div
          style={{ opacity: rightIndicatorOpacity }}
          className="absolute top-4 right-4 bg-emerald-500 text-white px-3 py-1.5 rounded-full font-bold text-xs shadow-md flex items-center gap-1 pointer-events-none z-20"
        >
          <span>Nhớ tốt (Good)</span>
          <ArrowRight className="w-4 h-4" />
        </motion.div>

        <motion.div
          style={{ opacity: leftIndicatorOpacity }}
          className="absolute top-4 left-4 bg-rose-500 text-white px-3 py-1.5 rounded-full font-bold text-xs shadow-md flex items-center gap-1 pointer-events-none z-20"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Chưa nhớ (Again)</span>
        </motion.div>

        {/* Top Meta */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
            {type}
          </span>
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>{isFlipped ? 'Đáp án (Mặt sau)' : 'Câu hỏi (Mặt trước)'}</span>
          </span>
        </div>

        {/* Content */}
        <div className="my-auto py-6 text-center">
          {isFlipped ? (
            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <p className="text-base sm:text-lg text-slate-800 leading-relaxed font-medium whitespace-pre-wrap">
                {back}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                {front}
              </h3>
            </div>
          )}
        </div>

        {/* Bottom Hint */}
        <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-400 flex items-center justify-center gap-1">
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{isFlipped ? 'Chạm để xem lại câu hỏi • Vuốt trái / phải để chấm điểm' : 'Chạm để lật đáp án • Vuốt trái (Chưa nhớ) / Vuốt phải (Nhớ tốt)'}</span>
        </div>
      </motion.div>
    </div>
  );
}
