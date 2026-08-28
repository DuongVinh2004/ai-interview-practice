import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  lines = 1,
  className,
  style,
  ...props
}: SkeletonProps) {
  const variantStyles = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full shrink-0',
    rectangular: 'rounded-xl',
    card: 'h-32 w-full rounded-2xl',
  };

  const inlineStyles: React.CSSProperties = {
    ...style,
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined
      ? { height: typeof height === 'number' ? `${height}px` : height }
      : {}),
  };

  const baseSkeletonClass = cn(
    'animate-pulse bg-slate-200/80 dark:bg-slate-800/80 transition-colors duration-300',
    variantStyles[variant],
    className,
  );

  if (variant === 'text' && lines > 1) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Đang tải nội dung..."
        className={cn('space-y-2.5 w-full', className)}
        {...props}
      >
        {Array.from({ length: lines }).map((_, idx) => (
          <div
            key={idx}
            className={cn(
              'animate-pulse bg-slate-200/80 dark:bg-slate-800/80 rounded transition-colors duration-300',
              idx === lines - 1 ? 'h-4 w-3/4' : 'h-4 w-full',
            )}
            style={idx === 0 ? inlineStyles : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-hidden="true"
      className={baseSkeletonClass}
      style={inlineStyles}
      {...props}
    />
  );
}

export default Skeleton;
