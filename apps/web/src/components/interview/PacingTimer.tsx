import { useState, useEffect } from 'react';
import { Timer, Clock } from 'lucide-react';
import { useI18nStore } from '../../stores/i18n.store';

interface PacingTimerProps {
  isActive: boolean;
  turnNumber: number;
}

export function PacingTimer({ isActive, turnNumber }: PacingTimerProps) {
  const [seconds, setSeconds] = useState(0);
  const { t } = useI18nStore();

  // Reset timer when turn number changes
  useEffect(() => {
    setSeconds(0);
  }, [turnNumber]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  // Pacing status: < 3 mins is green, 3-5 mins is amber, > 5 mins is warning
  const isOvertime = mins >= 5;
  const isWarning = mins >= 3 && mins < 5;

  const colorClass = isOvertime
    ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
    : isWarning
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold transition-all ${colorClass}`}
      title={`${t.interview.timerLabel} (Recommended: 3-5 mins)`}
    >
      {isOvertime ? <Clock className="h-3.5 w-3.5" /> : <Timer className="h-3.5 w-3.5" />}
      <span>{formattedTime}</span>
    </div>
  );
}
