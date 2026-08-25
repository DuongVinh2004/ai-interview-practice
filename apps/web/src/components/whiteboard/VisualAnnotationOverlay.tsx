import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, Lightbulb, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { VisualAnnotationDto } from '@ai-interview/contracts';

interface VisualAnnotationOverlayProps {
  annotations: VisualAnnotationDto[];
  isVisible?: boolean;
}

export const VisualAnnotationOverlay: React.FC<VisualAnnotationOverlayProps> = ({
  annotations = [],
  isVisible = true,
}) => {
  const [showOverlay, setShowOverlay] = useState(isVisible);
  const [activeAnnotationIndex, setActiveAnnotationIndex] = useState<number | null>(null);

  if (!annotations || annotations.length === 0) return null;

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          border: 'border-rose-500',
          bg: 'bg-rose-500/15 hover:bg-rose-500/25',
          badge: 'bg-rose-600 text-white',
          text: 'text-rose-700',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />,
        };
      case 'warning':
        return {
          border: 'border-amber-500',
          bg: 'bg-amber-500/15 hover:bg-amber-500/25',
          badge: 'bg-amber-600 text-white',
          text: 'text-amber-700',
          icon: <AlertCircle className="w-3.5 h-3.5 text-amber-600" />,
        };
      case 'good':
        return {
          border: 'border-emerald-500',
          bg: 'bg-emerald-500/15 hover:bg-emerald-500/25',
          badge: 'bg-emerald-600 text-white',
          text: 'text-emerald-700',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
        };
      default:
        return {
          border: 'border-sky-500',
          bg: 'bg-sky-500/15 hover:bg-sky-500/25',
          badge: 'bg-sky-600 text-white',
          text: 'text-sky-700',
          icon: <Lightbulb className="w-3.5 h-3.5 text-sky-600" />,
        };
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-30" data-testid="visual-annotation-overlay">
      {/* Visibility Toggle Button */}
      <div className="absolute top-3 right-3 pointer-events-auto z-40">
        <button
          type="button"
          onClick={() => setShowOverlay(prev => !prev)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
        >
          {showOverlay ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-indigo-600" />}
          <span>{showOverlay ? 'Ẩn nhận xét AI' : `Hiện nhận xét AI (${annotations.length})`}</span>
        </button>
      </div>

      {showOverlay &&
        annotations.map((ann, idx) => {
          const style = getSeverityStyle(ann.severity);
          const isSelected = activeAnnotationIndex === idx;

          return (
            <div
              key={idx}
              className={`absolute border-2 border-dashed rounded-xl transition-all duration-200 pointer-events-auto cursor-pointer ${style.border} ${style.bg} ${isSelected ? 'ring-4 ring-offset-1 ring-indigo-500/30' : ''}`}
              style={{
                left: `${Math.max(2, Math.min(90, ann.x))}%`,
                top: `${Math.max(2, Math.min(90, ann.y))}%`,
                width: `${Math.max(8, Math.min(60, ann.width))}%`,
                height: `${Math.max(8, Math.min(50, ann.height))}%`,
              }}
              onMouseEnter={() => setActiveAnnotationIndex(idx)}
              onMouseLeave={() => setActiveAnnotationIndex(null)}
              onClick={() => setActiveAnnotationIndex(prev => (prev === idx ? null : idx))}
            >
              {/* Badge Label */}
              <div className="absolute -top-3 left-2 flex items-center space-x-1 px-2 py-0.5 rounded-full shadow-sm text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm"
                style={{ backgroundColor: ann.severity === 'critical' ? '#e11d48' : ann.severity === 'warning' ? '#d97706' : ann.severity === 'good' ? '#059669' : '#0284c7', color: '#ffffff' }}>
                <span>{ann.label}</span>
              </div>

              {/* Tooltip Overlay */}
              {isSelected && (
                <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-slate-900 text-white rounded-2xl shadow-xl z-50 animate-fadeIn text-xs space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-slate-200">
                    {style.icon}
                    <span>{ann.label}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">{ann.suggestion}</p>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};
