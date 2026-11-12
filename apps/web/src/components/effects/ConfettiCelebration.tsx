import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';

export type ConfettiCelebrationType = 'win' | 'levelup' | 'streak' | 'burst' | 'cannons';

export interface ConfettiCelebrationProps {
  trigger: boolean;
  type?: ConfettiCelebrationType;
  durationMs?: number;
  onComplete?: () => void;
}

export const ConfettiCelebration: React.FC<ConfettiCelebrationProps> = ({
  trigger,
  type = 'win',
  durationMs = 2500,
  onComplete,
}) => {
  useEffect(() => {
    if (!trigger || typeof window === 'undefined') return;

    try {
      if (type === 'levelup') {
        const end = Date.now() + durationMs;
        const colors = ['#10b981', '#3b82f6', '#fbbf24', '#f43f5e'];

        const frame = () => {
          confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.7 },
            colors,
          });
          confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.7 },
            colors,
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        };
        frame();
      } else if (type === 'streak') {
        confetti({
          particleCount: 60,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#f97316', '#fbbf24', '#ef4444'],
        });
      } else {
        // Default win / burst
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#3b82f6', '#fbbf24', '#8b5cf6'],
        });
      }

      const timer = setTimeout(() => {
        onComplete?.();
      }, durationMs);

      return () => clearTimeout(timer);
    } catch {
      // Graceful fallback in non-canvas environments
    }
  }, [trigger, type, durationMs, onComplete]);

  return null;
};

export default ConfettiCelebration;
