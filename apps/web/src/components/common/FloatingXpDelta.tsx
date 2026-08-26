import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export interface FloatingXpDeltaProps {
  amount: number;
  reason?: string;
  onDone?: () => void;
  className?: string;
}

export function FloatingXpDelta({ amount, reason, onDone, className = '' }: FloatingXpDeltaProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onDone?.();
    }, 2200);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (!isVisible) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-extrabold text-xs shadow-lg animate-bounce duration-500 border border-amber-300 ${className}`}
      style={{ animationDuration: '0.8s' }}
    >
      <Sparkles
        className="h-3.5 w-3.5 text-amber-900 fill-amber-900 animate-spin"
        style={{ animationDuration: '3s' }}
      />
      <span>+{amount} XP</span>
      {reason && <span className="font-medium text-[11px] opacity-90">({reason})</span>}
    </div>
  );
}
