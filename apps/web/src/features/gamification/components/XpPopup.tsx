import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useGamificationStore } from '../../../stores/gamification.store';

export interface XpPopupProps {
  amount?: number;
  reason?: string;
  isVisible?: boolean;
  onDone?: () => void;
  className?: string;
}

export const XpPopup: React.FC<XpPopupProps> = ({
  amount,
  reason,
  isVisible: controlledVisible,
  onDone,
  className = '',
}) => {
  const { pendingXpDeltas, removePendingXpDelta } = useGamificationStore();
  const [internalVisible, setInternalVisible] = useState(true);

  // If amount is directly provided, use single standalone popup
  const isStandalone = amount !== undefined;
  const isShown = isStandalone
    ? (controlledVisible ?? internalVisible)
    : pendingXpDeltas.length > 0;

  useEffect(() => {
    if (isStandalone && isShown) {
      const timer = setTimeout(() => {
        setInternalVisible(false);
        onDone?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isStandalone, isShown, onDone]);

  if (isStandalone) {
    return (
      <AnimatePresence>
        {isShown && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.8 }}
            animate={{ opacity: 1, y: -20, scale: 1 }}
            exit={{ opacity: 0, y: -45, scale: 0.9 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className={`pointer-events-none z-50 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-slate-950 font-black text-sm shadow-xl border border-amber-200 select-none ${className}`}
            data-testid="xp-popup"
          >
            <Sparkles
              className="h-4 w-4 text-amber-900 fill-amber-900 animate-spin"
              style={{ animationDuration: '4s' }}
            />
            <span>+{amount} XP</span>
            {reason && <span className="font-semibold text-xs opacity-85">({reason})</span>}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Global store-driven floating stack
  return (
    <div
      className={`fixed bottom-8 right-8 z-50 flex flex-col-reverse gap-2 pointer-events-none ${className}`}
      data-testid="xp-popup-stack"
    >
      <AnimatePresence>
        {pendingXpDeltas.map(item => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 25, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.85 }}
            transition={{ duration: 0.6, ease: 'backOut' }}
            onAnimationComplete={() => {
              setTimeout(() => {
                removePendingXpDelta(item.id);
              }, 1800);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 text-slate-950 font-black text-sm shadow-2xl border border-amber-200/90 select-none shadow-amber-500/30"
          >
            <Sparkles className="h-4 w-4 text-amber-950 fill-amber-950" />
            <span className="tracking-wide">+{item.amount} XP</span>
            {item.reason && (
              <span className="font-semibold text-xs text-amber-950/80">• {item.reason}</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default XpPopup;
