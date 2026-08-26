import { ProgressSessionPoint } from '@ai-interview/contracts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatScore } from '../../lib/utils';

interface ProgressTrendChartProps {
  sessions: ProgressSessionPoint[];
  averageScore: number;
  highestScore: number;
  scoreVelocity: number;
}

export function ProgressTrendChart({
  sessions,
  averageScore,
  highestScore,
  scoreVelocity,
}: ProgressTrendChartProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-xs text-slate-400">
        No completed interview sessions available for progression tracking.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="progress-trend-chart">
      {/* Metric Highlights */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <p className="text-[11px] text-slate-500 font-medium">Average Score</p>
          <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
            {formatScore(averageScore)}{' '}
            <span className="text-xs text-slate-400 font-normal">/ 10</span>
          </p>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <p className="text-[11px] text-slate-500 font-medium">Peak Score</p>
          <p className="text-lg font-bold text-emerald-600 font-mono mt-0.5">
            {formatScore(highestScore)}{' '}
            <span className="text-xs text-slate-400 font-normal">/ 10</span>
          </p>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <p className="text-[11px] text-slate-500 font-medium">Score Velocity</p>
          <div className="flex items-center gap-1 mt-0.5">
            {scoreVelocity > 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : scoreVelocity < 0 ? (
              <TrendingDown className="h-4 w-4 text-rose-600" />
            ) : (
              <Minus className="h-4 w-4 text-slate-400" />
            )}
            <span
              className={`text-lg font-bold font-mono ${
                scoreVelocity > 0
                  ? 'text-emerald-600'
                  : scoreVelocity < 0
                    ? 'text-rose-600'
                    : 'text-slate-600'
              }`}
            >
              {scoreVelocity > 0 ? `+${scoreVelocity}` : scoreVelocity}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Progression Bar Timeline */}
      <div className="pt-2">
        <div className="flex items-end gap-2 h-36 border-b border-slate-200 pb-2 px-1">
          {sessions.map((s, idx) => {
            const score = Number((s as any).overallScore ?? (s as any).score ?? 0);
            const heightPercent = Math.max(15, (score / 10) * 100);
            const isLatest = idx === sessions.length - 1;

            return (
              <div
                key={s.sessionId || idx}
                className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
              >
                {/* Tooltip */}
                <div className="absolute -top-12 bg-slate-900 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md z-10">
                  <p className="font-semibold">
                    {s.jobRoleName || 'Technical'} ({s.seniorityLevelName || 'Practice'})
                  </p>
                  <p className="text-emerald-400">Score: {score.toFixed(1)}/10</p>
                </div>

                {/* Score label above bar */}
                <span className="text-[10px] font-bold font-mono text-slate-600 group-hover:text-emerald-600 transition-colors">
                  {score.toFixed(1)}
                </span>

                {/* Bar */}
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    isLatest
                      ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-sm'
                      : 'bg-gradient-to-t from-indigo-500 to-indigo-300 opacity-80 group-hover:opacity-100'
                  }`}
                />

                {/* Session index / turn */}
                <span className="text-[9px] text-slate-400 font-mono mt-1">#{idx + 1}</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[11px] text-slate-400 mt-2">
          <span>Earliest Sessions</span>
          <span>Latest Sessions</span>
        </div>
      </div>
    </div>
  );
}
