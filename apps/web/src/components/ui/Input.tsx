import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type = 'text', error, label, helperText, leftIcon, rightIcon, id, ...props },
    ref,
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            aria-invalid={!!error}
            className={cn(
              'w-full h-10 px-3.5 py-2 border rounded-lg text-sm text-slate-900 placeholder-slate-400 bg-white transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
              leftIcon && 'pl-9.5',
              rightIcon && 'pr-9.5',
              error
                ? 'border-rose-400 text-rose-900 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20'
                : 'border-slate-300 hover:border-slate-400',
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center text-slate-400">{rightIcon}</div>
          )}
        </div>
        {error && (
          <p className="text-xs font-medium text-rose-600 flex items-center gap-1 animate-fade-in">
            {error}
          </p>
        )}
        {!error && helperText && <p className="text-xs text-slate-500">{helperText}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
