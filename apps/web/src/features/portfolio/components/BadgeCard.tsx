import React from 'react';
import { BadgeLevel, CompetencyArea } from '@ai-interview/contracts';
import { Award, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { useI18nStore } from '../../../stores/i18n.store';

interface BadgeCardProps {
  areaName: string;
  competencyArea: CompetencyArea;
  level: BadgeLevel | null;
  score: number;
  evidenceCount: number;
  progressPercentage: number;
  nextBadgeLevel: BadgeLevel | null;
  requiredScore: number | null;
  requiredEvidence: number | null;
  isUnlocked: boolean;
  earnedAt?: string | null;
}

const BADGE_COLORS: Record<
  BadgeLevel,
  { bg: string; border: string; text: string; gradient: string; glow: string; ribbon: string }
> = {
  [BadgeLevel.BRONZE]: {
    bg: 'bg-amber-900/10',
    border: 'border-amber-700/30',
    text: 'text-amber-800',
    gradient: 'from-amber-600 to-amber-800',
    glow: 'shadow-amber-500/20',
    ribbon: 'bg-amber-700',
  },
  [BadgeLevel.SILVER]: {
    bg: 'bg-slate-300/20',
    border: 'border-slate-400/40',
    text: 'text-slate-800',
    gradient: 'from-slate-400 to-slate-600',
    glow: 'shadow-slate-400/20',
    ribbon: 'bg-slate-500',
  },
  [BadgeLevel.GOLD]: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/40',
    text: 'text-yellow-700',
    gradient: 'from-yellow-400 to-amber-500',
    glow: 'shadow-yellow-500/30',
    ribbon: 'bg-yellow-600',
  },
  [BadgeLevel.PLATINUM]: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/40',
    text: 'text-cyan-800',
    gradient: 'from-cyan-400 to-blue-600',
    glow: 'shadow-cyan-500/30',
    ribbon: 'bg-cyan-600',
  },
};

export const BadgeCard: React.FC<BadgeCardProps> = ({
  areaName,
  level,
  score,
  evidenceCount,
  progressPercentage,
  nextBadgeLevel,
  requiredScore,
  requiredEvidence,
  isUnlocked,
  earnedAt,
}) => {
  const { language } = useI18nStore();
  const isVi = language === 'vi';
  const badgeStyle = level ? BADGE_COLORS[level] : null;

  return (
    <div
      className={`relative rounded-xl border p-4 transition-all duration-300 ${
        isUnlocked && badgeStyle
          ? `${badgeStyle.bg} ${badgeStyle.border} shadow-sm hover:shadow-md`
          : 'bg-slate-50/80 border-slate-200 text-slate-400'
      }`}
      data-testid="badge-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md transition-transform duration-300 ${
              isUnlocked && badgeStyle
                ? `bg-gradient-to-br ${badgeStyle.gradient} text-white shadow-sm`
                : 'bg-slate-200 text-slate-400'
            }`}
          >
            {isUnlocked ? (
              level === BadgeLevel.PLATINUM ? (
                <Sparkles className="h-6 w-6 animate-pulse" />
              ) : (
                <Award className="h-6 w-6" />
              )
            ) : (
              <Lock className="h-5 w-5" />
            )}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-slate-900">{areaName}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              {isUnlocked && level ? (
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider text-white ${badgeStyle?.ribbon}`}
                >
                  {level}
                </span>
              ) : (
                <span className="text-xs text-slate-500 font-medium">
                  {isVi ? 'Chưa mở' : 'Locked'}
                </span>
              )}
              {isUnlocked && (
                <span className="text-xs font-semibold text-slate-700">
                  {score.toFixed(1)} / 10 ({evidenceCount} {isVi ? 'lượt' : 'tests'})
                </span>
              )}
            </div>
          </div>
        </div>

        {isUnlocked && <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />}
      </div>

      {/* Progress to next badge */}
      <div className="mt-4 pt-3 border-t border-slate-200/60">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5 font-medium">
          <span>
            {level === BadgeLevel.PLATINUM
              ? isVi
                ? 'Đã đạt cấp độ Xuất sắc nhất'
                : 'Mastery Level Achieved'
              : nextBadgeLevel
                ? isVi
                  ? `Mục tiêu tiếp theo: ${nextBadgeLevel} (Điểm ≥ ${requiredScore}, Số bài ≥ ${requiredEvidence})`
                  : `Next: ${nextBadgeLevel} (Score ≥ ${requiredScore}, Ev ≥ ${requiredEvidence})`
                : isVi
                  ? 'Mở khóa Đồng (Bronze)'
                  : 'Unlock Bronze'}
          </span>
          <span className="font-bold text-slate-700">{progressPercentage}%</span>
        </div>
        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              level === BadgeLevel.PLATINUM ? 'bg-cyan-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {earnedAt && (
          <p className="text-[11px] text-slate-400 mt-2 text-right">
            {isVi
              ? `Đạt được vào ${new Date(earnedAt).toLocaleDateString()}`
              : `Earned on ${new Date(earnedAt).toLocaleDateString()}`}
          </p>
        )}
      </div>
    </div>
  );
};
