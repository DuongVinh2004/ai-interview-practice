import { useEffect } from 'react';
import { useGamificationStore } from '../../../stores/gamification.store';
import { useI18nStore } from '../../../stores/i18n.store';
import { Sparkles, X } from 'lucide-react';

export function BadgeUnlockToast() {
  const { activeBadgeUnlock, dismissBadgeUnlock } = useGamificationStore();
  const { language } = useI18nStore();

  useEffect(() => {
    if (activeBadgeUnlock) {
      const timer = setTimeout(() => {
        dismissBadgeUnlock();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeBadgeUnlock, dismissBadgeUnlock]);

  if (!activeBadgeUnlock) return null;

  const badgeName = language === 'vi' ? activeBadgeUnlock.nameVi : activeBadgeUnlock.name;
  const badgeDesc =
    language === 'vi' ? activeBadgeUnlock.descriptionVi : activeBadgeUnlock.description;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl p-4 border border-amber-500/40 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start gap-3">
        {/* Badge Icon */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center text-2xl shadow-md shrink-0">
          {activeBadgeUnlock.iconUrl || '🏆'}
        </div>

        {/* Text */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Huy Hiệu Mới Đã Mở Khóa!' : 'New Badge Unlocked!'}</span>
          </div>
          <h4 className="text-sm font-bold text-white">{badgeName}</h4>
          <p className="text-xs text-slate-300 leading-snug">{badgeDesc}</p>
          <div className="pt-1">
            <span className="inline-block px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-mono font-bold text-[10px]">
              +{activeBadgeUnlock.xpReward} XP
            </span>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={dismissBadgeUnlock}
          className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
