import { ProgressTrendPointDto } from '@ai-interview/contracts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ProgressTrendChartProps {
  trends: ProgressTrendPointDto[];
  overallDelta: number;
  selectedPeriod: '7d' | '30d' | '90d' | '180d' | '365d';
  onPeriodChange: (period: '7d' | '30d' | '90d' | '180d' | '365d') => void;
}

export function ProgressTrendChart({
  trends,
  overallDelta,
  selectedPeriod,
  onPeriodChange,
}: ProgressTrendChartProps) {
  const periods: Array<'7d' | '30d' | '90d' | '180d' | '365d'> = [
    '7d',
    '30d',
    '90d',
    '180d',
    '365d',
  ];

  if (!trends || trends.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
        No trend data available for this range.
      </div>
    );
  }

  const height = 160;
  const width = 500;
  const padding = 24;

  const points = trends.map((t, idx) => {
    const x = padding + (idx / Math.max(1, trends.length - 1)) * (width - padding * 2);
    const y = height - padding - (t.overallScore / 10) * (height - padding * 2);
    return { x, y, score: t.overallScore, date: t.date };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="space-y-4" data-testid="progress-trend-chart">
      {/* Header with Delta & Period Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Trajectory Delta:</span>
          <span
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
              overallDelta > 0
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : overallDelta < 0
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            {overallDelta > 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : overallDelta < 0 ? (
              <TrendingDown className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
            {overallDelta > 0 ? `+${overallDelta}` : overallDelta} pts
          </span>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 gap-1">
          {periods.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                selectedPeriod === p
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Line Chart */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
          {/* Horizontal Grid lines */}
          {[2, 4, 6, 8, 10].map(lvl => {
            const y = height - padding - (lvl / 10) * (height - padding * 2);
            return (
              <g key={lvl}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3,3"
                />
                <text
                  x={padding - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[8px] fill-slate-400"
                >
                  {lvl}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill="rgba(16, 185, 129, 0.12)" />

          {/* Sparkline Path */}
          <path
            d={pathD}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {points.map((p, i) => (
            <g key={i} className="group">
              <circle cx={p.x} cy={p.y} r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
              <title>{`${p.date}: ${p.score}/10`}</title>
            </g>
          ))}
        </svg>

        {/* X-axis date labels */}
        <div className="flex justify-between text-[10px] text-slate-400 px-6 mt-1">
          <span>{trends[0]?.date}</span>
          <span>{trends[Math.floor(trends.length / 2)]?.date}</span>
          <span>{trends[trends.length - 1]?.date}</span>
        </div>
      </div>
    </div>
  );
}
