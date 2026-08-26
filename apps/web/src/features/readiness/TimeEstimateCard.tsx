import { Clock, Calendar, TrendingUp } from 'lucide-react';

interface TimeEstimateCardProps {
  weeksToNextTier: number | null;
  estimatedTargetDate: string | null;
  weeklyRate: number;
  currentTierSlug: string;
}

export function TimeEstimateCard({
  weeksToNextTier,
  estimatedTargetDate,
  weeklyRate,
  currentTierSlug,
}: TimeEstimateCardProps) {
  const isTopTier = currentTierSlug === 'tier-3';

  return (
    <div
      className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 border border-indigo-100 shadow-sm space-y-3"
      data-testid="time-estimate-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Offer Readiness Forecast
            </h4>
            <span className="text-[11px] text-slate-500">Based on weekly practice velocity</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>+{weeklyRate.toFixed(2)} pts/wk</span>
        </div>
      </div>

      <div className="pt-2 border-t border-indigo-100/70">
        {isTopTier ? (
          <div className="text-sm font-bold text-emerald-900 flex items-center gap-2">
            <span>🎉 Ready for Top-Tier Big Tech Interviews!</span>
          </div>
        ) : weeksToNextTier !== null ? (
          <div className="space-y-1">
            <div className="text-lg font-extrabold text-indigo-950">
              ~{weeksToNextTier} weeks{' '}
              <span className="text-xs font-semibold text-indigo-700">to Next Tier Target</span>
            </div>
            {estimatedTargetDate && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Estimated Target Date: {new Date(estimatedTargetDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Maintain consistent practice sessions to generate an estimated timeline.
          </p>
        )}
      </div>
    </div>
  );
}
