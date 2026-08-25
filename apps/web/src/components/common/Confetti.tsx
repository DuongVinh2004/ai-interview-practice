import { useEffect } from 'react';
import confetti from 'canvas-confetti';

export type ConfettiType = 'burst' | 'cannons' | 'fireworks' | 'levelup';

export interface ConfettiCelebrationProps {
  trigger: boolean;
  type?: ConfettiType;
  durationMs?: number;
  onComplete?: () => void;
}

export function triggerConfetti(type: ConfettiType = 'burst', durationMs: number = 2500) {
  if (typeof window === 'undefined') return;

  try {
    if (type === 'burst') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
      });
    } else if (type === 'cannons' || type === 'levelup') {
      const end = Date.now() + durationMs;
      const colors = ['#10b981', '#6366f1', '#fbbf24', '#f43f5e'];

      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors,
        });
        confetti({
          particleCount: 4,
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
    } else if (type === 'fireworks') {
      const end = Date.now() + durationMs;
      const interval: any = setInterval(() => {
        if (Date.now() > end) {
          clearInterval(interval);
          return;
        }
        confetti({
          startVelocity: 30,
          spread: 360,
          ticks: 60,
          origin: {
            x: Math.random() * 0.8 + 0.1,
            y: Math.random() * 0.5 + 0.1,
          },
        });
      }, 250);
    }
  } catch {
    // Ignore in non-canvas environments
  }
}

export function ConfettiCelebration({
  trigger,
  type = 'burst',
  durationMs = 2500,
  onComplete,
}: ConfettiCelebrationProps) {
  useEffect(() => {
    if (trigger) {
      triggerConfetti(type, durationMs);
      const timer = setTimeout(() => {
        onComplete?.();
      }, durationMs);
      return () => clearTimeout(timer);
    }
  }, [trigger, type, durationMs, onComplete]);

  return null;
}
