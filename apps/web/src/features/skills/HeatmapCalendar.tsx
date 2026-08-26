import { useMemo } from 'react';
import { Calendar } from 'lucide-react';

interface HeatmapCalendarProps {
  daysCount?: number;
}

export function HeatmapCalendar({ daysCount = 60 }: HeatmapCalendarProps) {
  // Generate sample practice density
  const days = useMemo(() => {
    const arr = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const intensity = i % 3 === 0 || i % 7 === 0 ? ((i * 13) % 4) + 1 : 0;
      arr.push({
        date: date.toISOString().split('T')[0],
        intensity,
      });
    }
    return arr;
  }, [daysCount]);

  const getColor = (intensity: number) => {
    if (intensity === 0) return 'bg-slate-100 border-slate-200/60';
    if (intensity === 1) return 'bg-emerald-200 border-emerald-300';
    if (intensity === 2) return 'bg-emerald-400 border-emerald-500';
    if (intensity === 3) return 'bg-emerald-600 border-emerald-700';
    return 'bg-emerald-700 border-emerald-800';
  };

  return (
    <div
      className="bg-white p-4 rounded-xl border border-slate-200 space-y-3"
      data-testid="heatmap-calendar"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span>Practice Activity Heatmap</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span>Less</span>
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-slate-200" />
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200" />
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
          <span>More</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {days.map(d => (
          <div
            key={d.date}
            title={`${d.date}: ${d.intensity > 0 ? d.intensity + ' sessions' : 'No activity'}`}
            className={`w-3.5 h-3.5 rounded-sm border transition-transform hover:scale-125 ${getColor(
              d.intensity,
            )}`}
          />
        ))}
      </div>
    </div>
  );
}
