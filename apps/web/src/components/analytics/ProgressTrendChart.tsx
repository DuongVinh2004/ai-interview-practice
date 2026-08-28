import { ProgressSessionPoint } from '@ai-interview/contracts';
import { TrendingUp, TrendingDown, Minus, Trophy, Award, Activity, Calendar } from 'lucide-react';
import { formatScore } from '../../lib/utils';
import { useI18nStore } from '../../stores/i18n.store';

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
  const { language } = useI18nStore();

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        {language === 'vi'
          ? 'Chưa có dữ liệu buổi phỏng vấn đã hoàn thành để theo dõi tiến trình.'
          : 'No completed interview sessions available for progression tracking.'}
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="progress-trend-chart">
      {/* 3 Metric Highlight Cards */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <div className="bg-gradient-to-br from-slate-50 to-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
            <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">
              {language === 'vi' ? 'Điểm trung bình' : 'Average Score'}
            </span>
          </div>
          <p className="text-base sm:text-lg font-extrabold text-slate-900 font-mono mt-1">
            {formatScore(averageScore)}{' '}
            <span className="text-[11px] text-slate-400 font-normal">/ 10</span>
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50/60 to-white p-3 rounded-2xl border border-emerald-200/80 shadow-2xs">
          <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-medium">
            <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{language === 'vi' ? 'Điểm cao nhất' : 'Peak Score'}</span>
          </div>
          <p className="text-base sm:text-lg font-extrabold text-emerald-700 font-mono mt-1">
            {formatScore(highestScore)}{' '}
            <span className="text-[11px] text-emerald-600/70 font-normal">/ 10</span>
          </p>
        </div>

        <div className="bg-gradient-to-br from-teal-50/60 to-white p-3 rounded-2xl border border-teal-200/80 shadow-2xs">
          <div className="flex items-center gap-1 text-[11px] text-teal-800 font-medium">
            <Activity className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span className="truncate">
              {language === 'vi' ? 'Tốc độ tăng trưởng' : 'Score Velocity'}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            {scoreVelocity > 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : scoreVelocity < 0 ? (
              <TrendingDown className="h-4 w-4 text-rose-600 shrink-0" />
            ) : (
              <Minus className="h-4 w-4 text-slate-400 shrink-0" />
            )}
            <span
              className={`text-base sm:text-lg font-extrabold font-mono ${
                scoreVelocity > 0
                  ? 'text-emerald-700'
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
      <div className="pt-2 relative">
        {/* Pass Target Benchmark Reference Line at 80% (8.0 score) */}
        <div className="relative h-40 border-b border-slate-200/90 pb-2 px-1 flex items-end gap-1.5 sm:gap-2">
          {/* Target 8.0 Dashed Guide Line */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-emerald-400/80 pointer-events-none z-0 flex items-center justify-end pr-2"
            style={{ bottom: '80%' }}
          >
            <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-white/90 dark:bg-slate-900 px-1.5 py-0.2 rounded border border-emerald-200/70 -translate-y-1/2 shadow-2xs">
              {language === 'vi' ? 'Mục tiêu Pass (8.0)' : 'Target Pass (8.0)'}
            </span>
          </div>

          {sessions.map((s, idx) => {
            const score = Number((s as any).overallScore ?? (s as any).score ?? 0);
            const heightPercent = Math.max(12, (score / 10) * 100);
            const isLatest = idx === sessions.length - 1;
            const isPass = score >= 8.0;
            const isGood = score >= 6.0;

            const roleShort = (s.jobRoleName || 'IT')
              .replace('Software Engineer', 'SWE')
              .replace('Engineer', '')
              .trim();
            const levelShort = (s.seniorityLevelName || 'Mid')
              .replace('Senior', 'Sr')
              .replace('Junior', 'Jr')
              .replace('Staff', 'Stf')
              .trim();

            const dateLabel = s.completedAt
              ? new Date(s.completedAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
                  day: '2-digit',
                  month: '2-digit',
                })
              : '';

            return (
              <div
                key={s.sessionId || idx}
                className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end z-10"
              >
                {/* Rich Glass Tooltip on Hover */}
                <div className="absolute -top-16 bg-slate-900/95 text-white text-[10px] px-2.5 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap shadow-xl z-30 border border-slate-700 backdrop-blur-md -translate-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>
                      {s.jobRoleName || 'Technical'} ({s.seniorityLevelName || 'Practice'})
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold ${
                        isPass
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isGood
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {isPass
                        ? language === 'vi'
                          ? 'Đạt chuẩn'
                          : 'Passed'
                        : isGood
                          ? language === 'vi'
                            ? 'Tiềm năng'
                            : 'Good'
                          : language === 'vi'
                            ? 'Cần ôn thêm'
                            : 'Needs Practice'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-slate-300 mt-1">
                    <span className="flex items-center gap-1 font-mono text-[9.5px]">
                      <Calendar className="w-2.5 h-2.5" />
                      {dateLabel || `Session #${idx + 1}`}
                    </span>
                    <span className="text-emerald-400 font-extrabold font-mono">
                      {score.toFixed(1)} / 10
                    </span>
                  </div>
                </div>

                {/* Score label above bar */}
                <span
                  className={`text-[9.5px] sm:text-[10.5px] font-mono font-bold transition-colors ${
                    isPass
                      ? 'text-emerald-700 font-extrabold'
                      : isGood
                        ? 'text-indigo-700'
                        : 'text-amber-700'
                  }`}
                >
                  {score.toFixed(1)}
                </span>

                {/* Vertical Bar */}
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    isPass
                      ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                      : isGood
                        ? 'bg-gradient-to-t from-indigo-600 via-blue-500 to-teal-400'
                        : 'bg-gradient-to-t from-amber-500 to-yellow-400'
                  } ${
                    isLatest
                      ? 'ring-2 ring-emerald-500/40 ring-offset-1'
                      : 'opacity-90 hover:opacity-100'
                  }`}
                />

                {/* Compact Role Tag / Session Index */}
                <div className="flex flex-col items-center mt-1">
                  <span className="text-[8.5px] text-slate-700 font-semibold truncate max-w-[38px] leading-tight">
                    {roleShort} {levelShort}
                  </span>
                  <span className="text-[7.5px] text-slate-400 font-mono">#{idx + 1}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 px-1">
          <span className="font-medium text-slate-400">
            {language === 'vi' ? '← Các buổi phỏng vấn đầu' : '← Earliest Sessions'}
          </span>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>≥ 8.0 {language === 'vi' ? '(Đạt)' : '(Pass)'}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
              <span>6.0 - 7.9</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <span>&lt; 6.0</span>
            </span>
          </div>
          <span className="font-medium text-slate-400">
            {language === 'vi' ? 'Buổi gần nhất →' : 'Latest Sessions →'}
          </span>
        </div>
      </div>
    </div>
  );
}
