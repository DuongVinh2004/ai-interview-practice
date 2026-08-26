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
      <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-xs text-slate-400 animate-pulse">
        <span className="h-3 w-16 bg-slate-200 rounded"></span>
      </div>
    );
  }

  const levelTitle = language === 'vi' ? profile.levelTitleVi : profile.levelTitle;

  return (
    <div className="flex items-center gap-2 sm:gap-3" data-testid="xp-progress-widget">
      {/* Daily Login Claim Pill */}
      {!profile.dailyLoginClaimed && (
        <button
          type="button"
          onClick={() => claimDailyLogin()}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold text-xs shadow-xs hover:shadow-md transition-all hover:scale-105 active:scale-95 animate-pulse"
          title={language === 'vi' ? 'Nhận +10 XP điểm danh hôm nay' : 'Claim +10 XP Daily Login'}
        >
          <Sparkles className="h-3 w-3 text-amber-900 fill-amber-900" />
          <span>+10 XP</span>
        </button>
      )}

      {/* Streak Badge */}
      <Link
        to="/flashcards"
        className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-xs font-bold hover:bg-orange-100 transition-colors"
        title={
          language === 'vi'
            ? `Chuỗi học tập: ${profile.streak.currentStreak} ngày`
            : `Active Streak: ${profile.streak.currentStreak} days`
        }
      >
        <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-500" />
        <span>{profile.streak.currentStreak}</span>
        {profile.streak.freezeCount > 0 && (
          <span
            className="flex items-center text-cyan-700 ml-0.5"
            title={
              language === 'vi'
                ? `Đang có ${profile.streak.freezeCount} khiên bảo vệ chuỗi`
                : `${profile.streak.freezeCount} Streak Freezes available`
            }
          >
            <Shield className="h-3 w-3 text-cyan-600 fill-cyan-100" />
          </span>
        )}
      </Link>

      {/* Level & XP Bar Link */}
      <Link
        to="/gamification/badges"
        className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs transition-colors group"
        title={`${levelTitle} • ${profile.totalXp} XP (${profile.levelProgressPercent}%)`}
      >
        <div className="flex items-center gap-1 font-bold text-emerald-700">
          <Trophy className="h-3.5 w-3.5 text-emerald-600" />
          <span>Lv.{profile.currentLevel}</span>
        </div>

        <div className="hidden sm:flex flex-col items-start gap-0.5">
          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${profile.levelProgressPercent}%` }}
            />
          </div>
        </div>

        <span className="font-semibold font-mono text-[11px] text-slate-500 group-hover:text-slate-900">
          <CounterAnimation to={profile.totalXp} /> XP
        </span>
      </Link>
    </div>
  );
}
