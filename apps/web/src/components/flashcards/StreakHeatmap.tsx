import React from 'react';
import { Flame, Trophy, Calendar } from 'lucide-react';
import { HeatmapEntry, UserStreakDto } from '@ai-interview/contracts';

interface StreakHeatmapProps {
  streak?: UserStreakDto;
  heatmap?: HeatmapEntry[];
}

export const StreakHeatmap: React.FC<StreakHeatmapProps> = ({
  streak = { currentStreak: 0, longestStreak: 0, totalReviews: 0 },
  heatmap = [],
}) => {
  // Generate last 28 days for grid
  const days: { dateStr: string; dayLabel: string; count: number }[] = [];
  const today = new Date();
  const countsMap = new Map(heatmap.map(h => [h.date, h.count]));

  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('vi-VN', { weekday: 'narrow' });
    days.push({
      dateStr,
      dayLabel,
      count: countsMap.get(dateStr) || 0,
    });
  }

  const getIntensityClass = (count: number) => {
    if (count === 0) return 'bg-slate-100 border-slate-200';
    if (count <= 2) return 'bg-emerald-200 border-emerald-300';
    if (count <= 5) return 'bg-emerald-400 border-emerald-500';
    return 'bg-emerald-600 border-emerald-700 text-white';
  };

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4"
      data-testid="streak-heatmap"
    >
      {/* Streak Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Lịch sử ôn luyện (Spaced Repetition Activity)
          </h4>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
            <Flame className="w-3.5 h-3.5 fill-amber-500" />
            <span>{streak.currentStreak} ngày liên tiếp</span>
          </div>

          <div className="flex items-center space-x-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
            <Trophy className="w-3.5 h-3.5" />
            <span>Kỷ lục: {streak.longestStreak} ngày</span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid (4 weeks x 7 days) */}
      <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 pt-1">
        {days.map(d => (
          <div
            key={d.dateStr}
            title={`${d.dateStr}: ${d.count} lượt ôn`}
            className={`h-7 rounded-md border flex flex-col items-center justify-center text-[10px] font-semibold transition-all ${getIntensityClass(
              d.count,
            )}`}
          >
            {d.count > 0 ? d.count : ''}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
        <span>
          Tổng cộng: <strong className="text-slate-700">{streak.totalReviews}</strong> lượt ôn luyện
        </span>
        <div className="flex items-center space-x-1">
          <span>Ít</span>
          <div className="w-3 h-3 bg-slate-100 border rounded" />
          <div className="w-3 h-3 bg-emerald-200 border rounded" />
          <div className="w-3 h-3 bg-emerald-400 border rounded" />
          <div className="w-3 h-3 bg-emerald-600 border rounded" />
          <span>Nhiều</span>
        </div>
      </div>
    </div>
  );
};
