import { useEffect } from 'react';
import { useGamificationStore } from '../../../stores/gamification.store';
import { useI18nStore } from '../../../stores/i18n.store';
import { CounterAnimation } from '../../../components/common/CounterAnimation';
import { Flame, Shield, Sparkles, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

export function XpProgressWidget() {
  const { profile, fetchProfile, claimDailyLogin } = useGamificationStore();
  const { language } = useI18nStore();

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (!profile) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 rounded-full text-xs text-slate-400 animate-pulse shrink-0">
        <span className="h-3.5 w-14 bg-slate-200 rounded-full"></span>
      </div>
    );
  }

  const levelTitle = language === 'vi' ? profile.levelTitleVi : profile.levelTitle;
  const nextLevelXp = profile.nextLevelXp || profile.currentLevel * 100;
  const remainingXp = Math.max(0, nextLevelXp - profile.totalXp);
  const progressPercent = Math.min(100, Math.max(4, profile.levelProgressPercent || 0));

  return (
    <div
      className="flex items-center gap-2 sm:gap-2.5 shrink-0 whitespace-nowrap"
      data-testid="xp-progress-widget"
    >
      {/* Daily Login Claim Chip */}
      {!profile.dailyLoginClaimed && (
        <button
          type="button"
          onClick={() => claimDailyLogin()}
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-300/60 font-bold text-xs transition-all hover:scale-105 active:scale-95 shadow-2xs"
          title={language === 'vi' ? 'Nhận +10 XP điểm danh hôm nay' : 'Claim +10 XP Daily Login'}
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-600 fill-amber-500" />
          <span>+10 XP</span>
        </button>
      )}

      {/* Streak Badge */}
      <Link
        to="/flashcards"
        className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full bg-orange-50/90 hover:bg-orange-100 text-orange-800 border border-orange-200/90 text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-2xs dark:bg-orange-950/40 dark:border-orange-900/60 dark:text-orange-300 group shrink-0"
        title={
          language === 'vi'
            ? `Chuỗi học tập: ${profile.streak.currentStreak} ngày liên tục`
            : `Active Streak: ${profile.streak.currentStreak} days`
        }
      >
        <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-500 shrink-0 group-hover:scale-110 transition-transform" />
        <span>{profile.streak.currentStreak}</span>
        {profile.streak.freezeCount > 0 && (
          <span
            className="flex items-center text-cyan-600 dark:text-cyan-400 ml-0.5"
            title={
              language === 'vi'
                ? `Đang có ${profile.streak.freezeCount} khiên bảo vệ chuỗi`
                : `${profile.streak.freezeCount} Streak Freezes available`
            }
          >
            <Shield className="h-3 w-3 fill-cyan-100 dark:fill-cyan-950" />
          </span>
        )}
      </Link>

      {/* Level & XP Progress Pill */}
      <Link
        to="/gamification/badges"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50/95 hover:bg-slate-100 border border-slate-200/90 shadow-2xs hover:border-emerald-300 dark:bg-slate-800/80 dark:border-slate-700 dark:hover:bg-slate-800 text-xs transition-all group shrink-0"
        title={`${levelTitle} • Đang có ${profile.totalXp} XP. Cần thêm ${remainingXp} XP để lên Lv.${profile.currentLevel + 1} (${profile.levelProgressPercent}%)`}
      >
        {/* Trophy + Level Badge */}
        <div className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
          <Trophy className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
          <span>Lv.{profile.currentLevel}</span>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="flex flex-col justify-center shrink-0">
          <div className="w-12 sm:w-14 md:w-16 h-2 bg-slate-200/90 dark:bg-slate-700 rounded-full overflow-hidden p-0.5 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-500 shadow-xs"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* XP Fraction & Remaining XP */}
        <div className="flex items-center gap-1 font-mono text-[11px] shrink-0">
          <span className="font-bold text-slate-800 dark:text-slate-200">
            <CounterAnimation to={profile.totalXp} />
          </span>
          <span className="text-slate-400 dark:text-slate-500 font-normal">/{nextLevelXp}</span>
          <span className="text-slate-500 dark:text-slate-400 font-semibold">XP</span>
          <span className="hidden md:inline-block text-[10px] font-sans font-medium text-emerald-600 dark:text-emerald-400 ml-0.5 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
            +{remainingXp}
          </span>
        </div>
      </Link>
    </div>
  );
}
