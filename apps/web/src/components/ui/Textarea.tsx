import React from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  maxChars?: number;
  currentChars?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, id, maxChars, currentChars, ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-1">
          {label && (
            <label htmlFor={id} className="block text-sm font-medium text-slate-700">
              {label}
            </label>
          )}
          {maxChars !== undefined && currentChars !== undefined && (
            <span
              className={cn(
                'text-xs font-mono',
                currentChars > maxChars ? 'text-rose-600 font-bold' : 'text-slate-400',
              )}
            >
              {currentChars} / {maxChars} characters
            </span>
          )}
        </div>
        <textarea
          id={id}
          ref={ref}
          className={cn(
            'w-full px-3.5 py-2.5 border rounded-lg text-sm text-slate-900 placeholder-slate-400 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[120px]',
            error
              ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
              : 'border-slate-300',
            className,
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
