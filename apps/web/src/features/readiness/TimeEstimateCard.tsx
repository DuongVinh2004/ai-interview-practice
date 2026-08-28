import { Trophy, TrendingUp, Target } from 'lucide-react';
import { useI18nStore } from '../../stores/i18n.store';

interface TimeEstimateCardProps {
  weeksToNextTier: number | null;
  estimatedTargetDate?: string | null;
  weeklyRate: number;
  currentTierSlug: string;
}

export function TimeEstimateCard({
  weeksToNextTier,
  weeklyRate,
  currentTierSlug,
}: TimeEstimateCardProps) {
  const { language } = useI18nStore();
  const isVi = language === 'vi';
  const isTopTier = currentTierSlug === 'tier-3';

  return (
    <div
      className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 border border-indigo-100 shadow-sm space-y-3"
      data-testid="time-estimate-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {isVi ? 'Tiến Độ & Mục Tiêu Luyện Tập' : 'Practice Progression & Goals'}
            </h4>
            <span className="text-[11px] text-slate-500">
              {isVi
                ? 'Đánh giá theo tốc độ hoàn thành bài phỏng vấn'
                : 'Evaluated by interview practice velocity'}
            </span>
          </div>
        </div>

        {weeklyRate > 0 && (
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>
              +{weeklyRate.toFixed(2)} {isVi ? 'điểm/tuần' : 'pts/wk'}
            </span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-indigo-100/70">
        {isTopTier ? (
          <div className="text-sm font-bold text-emerald-900 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {isVi
                ? '🎉 Đã sẵn sàng cho các vòng phỏng vấn kỹ thuật cấp cao!'
                : '🎉 Ready for Top-Tier Big Tech Interviews!'}
            </span>
          </div>
        ) : weeksToNextTier !== null ? (
          <div className="space-y-1.5">
            <div className="text-sm font-bold text-indigo-950">
              {isVi ? (
                <>
                  Mục tiêu thăng hạng tiếp theo:{' '}
                  <span className="text-emerald-700 font-extrabold">
                    Cần hoàn thành thêm ~{Math.max(2, weeksToNextTier)} bài phỏng vấn thử
                  </span>
                </>
              ) : (
                <>
                  Next tier target:{' '}
                  <span className="text-emerald-700 font-extrabold">
                    Complete ~{Math.max(2, weeksToNextTier)} more mock interviews
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-600">
              {isVi
                ? 'Tập trung trả lời đầy đủ theo mô hình STAR và giải quyết các câu hỏi về Hệ thống & Database để tăng điểm nhanh nhất.'
                : 'Structure responses with the STAR method and focus on System Design & Database questions to accelerate progress.'}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            {isVi
              ? 'Hoàn thành các bài phỏng vấn thử để hệ thống đo lường vận tốc tiến bộ và dự báo năng lực.'
              : 'Complete mock interviews for the system to measure velocity and project readiness.'}
          </p>
        )}
      </div>
    </div>
  );
}
