import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score?: number | null): string {
  if (score === undefined || score === null) return 'N/A';
  return score.toFixed(1);
}

export function formatDifficulty(diff: number): { label: string; color: string } {
  switch (diff) {
    case 1:
      return { label: 'Easy', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    case 2:
      return { label: 'Medium', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    case 3:
      return { label: 'Hard', color: 'bg-rose-100 text-rose-800 border-rose-300' };
    default:
      return { label: 'Normal', color: 'bg-slate-100 text-slate-800 border-slate-300' };
  }
}
