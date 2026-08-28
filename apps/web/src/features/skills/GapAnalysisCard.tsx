import { Link } from 'react-router-dom';
import { GapAnalysisItemDto } from '@ai-interview/contracts';
import { AlertCircle, ArrowRight, Target, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useI18nStore } from '../../stores/i18n.store';

interface GapAnalysisCardProps {
  gap: GapAnalysisItemDto;
}

export function GapAnalysisCard({ gap }: GapAnalysisCardProps) {
  const { language } = useI18nStore();
  const isVi = language === 'vi';
  const isHigh = gap.priority === 'HIGH';

  const localizedName = isVi
    ? gap.name
        .replace('Architecture & Design Patterns', 'Kiến Trúc & Mẫu Thiết Kế')
        .replace('System Design', 'Thiết Kế Hệ Thống')
        .replace('Database & Concurrency', 'Cơ Sở Dữ Liệu & Đồng Thời')
        .replace('Resilience & Security', 'Bảo Mật & Khả Năng Chịu Lỗi')
        .replace('Language Core', 'Ngôn Ngữ Lập Trình')
        .replace('Fundamentals', 'Nền Tảng Cốt Lõi')
        .replace('Advanced Concepts', 'Khái Niệm Nâng Cao')
        .replace('Optimization & Performance', 'Tối Ưu Hóa & Hiệu Năng')
        .replace('Real-world Trade-offs', 'Đánh Đổi Thực Tế')
        .replace('Distributed Lock Contention', 'Xung Đột Khóa Phân Tán (Lock Contention)')
    : gap.name;

  const localizedRecommendation = isVi
    ? gap.recommendation.startsWith('Master Redis')
      ? gap.recommendation
      : `Cải thiện ${localizedName} thông qua luyện tập các tình huống thực tế và đánh đổi kỹ thuật.`
    : gap.recommendation;

  const areaViMap: Record<string, string> = {
    SYSTEM_DESIGN: 'Thiết Kế Hệ Thống',
    LANGUAGE_CORE: 'Ngôn Ngữ Chuyên Sâu',
    DATABASE_CONCURRENCY: 'Cơ Sở Dữ Liệu & Đồng Thời',
    ARCHITECTURE_PATTERNS: 'Kiến Trúc & Mẫu Thiết Kế',
    RESILIENCE_SECURITY: 'Bảo Mật & Khả Năng Chịu Lỗi',
  };

  const localizedAction = isVi
    ? `Bắt đầu phiên Luyện tập Trọng tâm trong phần ${areaViMap[gap.competencyArea] || gap.competencyArea}.`
    : gap.suggestedAction;

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isHigh ? 'bg-rose-50/40 border-rose-200 shadow-sm' : 'bg-amber-50/30 border-amber-200'
      }`}
      data-testid="gap-analysis-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div
            className={`p-1.5 rounded-lg mt-0.5 ${
              isHigh ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isHigh ? <AlertCircle className="w-4 h-4" /> : <Target className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">{localizedName}</h4>
              <span
                className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                  isHigh
                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                    : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}
              >
                {isVi ? (isHigh ? 'Ưu Tiên Cao' : 'Ưu Tiên Vừa') : `${gap.priority} PRIORITY`}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">{localizedRecommendation}</p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xs font-bold text-slate-900">
            {gap.currentScore.toFixed(1)}{' '}
            <span className="text-[10px] text-slate-400 font-normal">
              / {gap.targetScore.toFixed(1)}
            </span>
          </div>
          <span className="text-[10px] font-semibold text-rose-600 block">
            -{gap.gapScore.toFixed(1)} {isVi ? 'điểm thiếu' : 'pt gap'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200/60">
        <span className="text-xs text-slate-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          {localizedAction}
        </span>

        <Link to="/interviews/new">
          <Button variant="outline" size="sm" className="gap-1 text-xs py-1 h-7">
            <span>{isVi ? 'Luyện tập ngay' : 'Practice'}</span>
            <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
