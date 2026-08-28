import React from 'react';
import { cn } from '../../lib/utils';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'emerald' | 'indigo' | 'amber' | 'rose' | 'slate';
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = false,
  variant = 'emerald',
  size = 'md',
  className,
  ...props
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const sizeStyles = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const fillVariants = {
    emerald: 'bg-emerald-500',
    indigo: 'bg-indigo-600',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-600',
  };

  return (
    <div className={cn('w-full space-y-1.5', className)} {...props}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label && <span>{label}</span>}
          {showPercentage && (
            <span className="font-mono text-slate-500 dark:text-slate-400">{percentage}%</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || 'Progress'}
        className={cn(
          'w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700',
          sizeStyles[size],
        )}
      >
        <div
          className={cn(
            'h-full transition-all duration-300 ease-out rounded-full',
            fillVariants[variant],
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
