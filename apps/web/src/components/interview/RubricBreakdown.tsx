import { formatScore } from '../../lib/utils';
import { useI18nStore } from '../../stores/i18n.store';

interface RubricScores {
  technicalAccuracy?: number;
  depth?: number;
  clarity?: number;
}

interface RubricBreakdownProps {
  scores?: RubricScores;
}

export function RubricBreakdown({ scores }: RubricBreakdownProps) {
  const { t } = useI18nStore();

  const tech = scores?.technicalAccuracy ?? 0;
  const depth = scores?.depth ?? 0;
  const clarity = scores?.clarity ?? 0;

  const items = [
    {
      label: t.interview.technicalAccuracy,
      weight: '40%',
      score: tech,
      percentage: Math.min(100, Math.round(tech * 10)),
      color: 'bg-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-900',
      borderColor: 'border-blue-200',
    },
    {
      label: t.interview.depth,
      weight: '30%',
      score: depth,
      percentage: Math.min(100, Math.round(depth * 10)),
      color: 'bg-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-900',
      borderColor: 'border-purple-200',
    },
    {
      label: t.interview.clarity,
      weight: '30%',
      score: clarity,
      percentage: Math.min(100, Math.round(clarity * 10)),
      color: 'bg-emerald-600',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-900',
      borderColor: 'border-emerald-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map((item, idx) => (
        <div
          key={idx}
          className={`p-3.5 rounded-xl border ${item.borderColor} ${item.bgColor} flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">{item.label}</span>
            <span className="text-[10px] text-slate-400 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
              {item.weight}
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <span className={`text-xl font-bold font-mono ${item.textColor}`}>
              {formatScore(item.score)}
            </span>
            <span className="text-xs text-slate-500">/ 10</span>
          </div>

          <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${item.color} rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${item.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
