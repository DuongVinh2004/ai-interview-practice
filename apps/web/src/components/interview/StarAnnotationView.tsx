import React from 'react';
import { Card } from '../ui/Card';

interface StarAnnotationViewProps {
  situationText?: string | null;
  taskText?: string | null;
  actionText?: string | null;
  resultText?: string | null;
}

export const StarAnnotationView: React.FC<StarAnnotationViewProps> = ({
  situationText,
  taskText,
  actionText,
  resultText,
}) => {
  return (
    <Card className="p-4 bg-white border-slate-200 shadow-sm" data-testid="star-annotation-view">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
        STAR Structured Narrative Decomposition
      </div>

      <div className="space-y-3 text-xs leading-relaxed">
        {situationText && (
          <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-950">
            <span className="font-bold text-amber-800 uppercase tracking-wider block text-[10px] mb-1">
              [S] Situation / Context:
            </span>
            <span>{situationText}</span>
          </div>
        )}

        {taskText && (
          <div className="p-3 rounded-lg bg-sky-50/80 border border-sky-200 text-sky-950">
            <span className="font-bold text-sky-800 uppercase tracking-wider block text-[10px] mb-1">
              [T] Task / Objective:
            </span>
            <span>{taskText}</span>
          </div>
        )}

        {actionText && (
          <div className="p-3 rounded-lg bg-orange-50/80 border border-orange-200 text-orange-950">
            <span className="font-bold text-orange-800 uppercase tracking-wider block text-[10px] mb-1">
              [A] Personal Action & Initiative:
            </span>
            <span>{actionText}</span>
          </div>
        )}

        {resultText && (
          <div className="p-3 rounded-lg bg-emerald-50/80 border border-emerald-200 text-emerald-950">
            <span className="font-bold text-emerald-800 uppercase tracking-wider block text-[10px] mb-1">
              [R] Measurable Result & Outcome:
            </span>
            <span>{resultText}</span>
          </div>
        )}
      </div>
    </Card>
  );
};
