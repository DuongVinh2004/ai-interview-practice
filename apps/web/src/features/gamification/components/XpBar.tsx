import React from 'react';
import { useGamificationStore } from '../../../stores/gamification.store';
import { useI18nStore } from '../../../stores/i18n.store';
import { Trophy, Sparkles } from 'lucide-react';
import { CounterAnimation } from '../../../components/common/CounterAnimation';

export interface XpBarProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export const XpBar: React.FC<XpBarProps> = ({
  className = '',
  showDetails = true,
  compact = false,
}) => {
  const { profile } = useGamificationStore();
  const { language } = useI18nStore();

  if (!profile) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full animate-pulse ${className}`}
      >
        <div className="h-3 w-16 bg-slate-200 rounded-full" />
      </div>
    );
  }

  const levelTitle = language === 'vi' ? profile.levelTitleVi : profile.levelTitle;
  const currentLevel = profile.currentLevel || 1;
  const totalXp = profile.totalXp || 0;
  const nextLevelXp = profile.nextLevelXp || currentLevel * 100;
  const currentLevelMinXp = profile.currentLevelMinXp || 0;
  const levelProgressPercent = Math.min(
    100,
    Math.max(
      3,
      profile.levelProgressPercent ??
        Math.round(
          ((totalXp - currentLevelMinXp) / Math.max(1, nextLevelXp - currentLevelMinXp)) * 100,
        ),
    ),
  );
  const remainingXp = Math.max(0, nextLevelXp - totalXp);

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200/90 text-xs shadow-2xs ${className}`}
        title={`${levelTitle} • ${totalXp}/${nextLevelXp} XP (${levelProgressPercent}%)`}
        data-testid="xp-bar"
      >
        <div className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
          <Trophy className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span>Lv.{currentLevel}</span>
        </div>
        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${levelProgressPercent}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-slate-500 shrink-0">
          {levelProgressPercent}%
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs ${className}`}
      data-testid="xp-bar"
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
          <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 text-[11px] font-extrabold">
            Lv.{currentLevel}
          </span>
          <span className="text-slate-700 dark:text-slate-200">{levelTitle}</span>
        </div>

        {showDetails && (
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span className="font-bold text-slate-800 dark:text-slate-200">
              <CounterAnimation to={totalXp} />
            </span>
            <span>/{nextLevelXp} XP</span>
          </div>
        )}
      </div>

      {/* Gradient Progress Bar */}
      <div className="relative w-full h-2.5 bg-slate-100 dark:bg-slate-700/80 rounded-full overflow-hidden p-0.5 shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-500 shadow-xs"
          style={{ width: `${levelProgressPercent}%` }}
          role="progressbar"
          aria-valuenow={levelProgressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {showDetails && (
        <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500">
          <span>{levelProgressPercent}% hoàn thành</span>
          <span>
            {language === 'vi'
              ? `Còn ${remainingXp} XP để lên cấp`
              : `${remainingXp} XP to next level`}
          </span>
        </div>
      )}
    </div>
  );
};

export default XpBar;
