import { useState, useEffect } from 'react';

export interface CounterAnimationProps {
  from?: number;
  to: number;
  duration?: number;
  formatter?: (val: number) => string;
  className?: string;
}

export function CounterAnimation({
  from = 0,
  to,
  duration = 1000,
  formatter = val => val.toLocaleString(),
  className,
}: CounterAnimationProps) {
  const [current, setCurrent] = useState(from);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let frameId: number;

    const startVal = from;
    const endVal = to;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const val = Math.round(startVal + (endVal - startVal) * easedProgress);

      setCurrent(val);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [from, to, duration]);

  return <span className={className}>{formatter(current)}</span>;
}
