import { useEffect } from 'react';
import { useGamificationStore } from '../../../stores/gamification.store';
import { useI18nStore } from '../../../stores/i18n.store';
import { ConfettiCelebration } from '../../../components/common/Confetti';
import { Button } from '../../../components/ui/Button';
import { Award, Sparkles, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function LevelUpModal() {
  const { activeLevelUp, dismissLevelUp } = useGamificationStore();
  const { language } = useI18nStore();
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeLevelUp) {
        dismissLevelUp();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLevelUp, dismissLevelUp]);

  if (!activeLevelUp) return null;

  const levelTitle = language === 'vi' ? activeLevelUp.levelTitleVi : activeLevelUp.levelTitle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <ConfettiCelebration trigger={true} type="levelup" durationMs={3500} />

      <div className="relative w-full max-w-md p-6 sm:p-8 bg-white rounded-3xl shadow-2xl border border-emerald-100 text-center space-y-6 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={dismissLevelUp}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Level Up Trophy Icon */}
        <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-yellow-300 rounded-full blur-lg opacity-70 animate-pulse" />
          <div className="relative w-20 h-20 bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 rounded-2xl shadow-xl flex items-center justify-center border-2 border-white">
            <Award className="w-10 h-10 text-slate-950" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-yellow-500 fill-yellow-400 animate-bounce" />
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold uppercase tracking-wider">
            {language === 'vi' ? '🎉 Lên Cấp Độ Mới!' : '🎉 Level Up!'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Level {activeLevelUp.newLevel}
          </h2>
          <p className="text-base font-semibold text-emerald-700">{levelTitle}</p>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            {language === 'vi'
              ? `Chúc mừng bạn đã đạt cột mốc ${activeLevelUp.totalXp.toLocaleString()} XP tổng cộng. Kỹ năng phỏng vấn kỹ thuật của bạn đang tiến bộ vượt bậc!`
              : `Congratulations on reaching ${activeLevelUp.totalXp.toLocaleString()} total XP. Your engineering interview mastery is advancing!`}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <Button
            variant="outline"
            className="w-full text-xs"
            onClick={() => {
              dismissLevelUp();
              navigate('/gamification/badges');
            }}
          >
            <span>{language === 'vi' ? 'Xem Bộ Huy Hiệu' : 'View Badges'}</span>
          </Button>
          <Button
            variant="primary"
            className="w-full text-xs font-bold gap-1 shadow-md bg-emerald-600 hover:bg-emerald-700"
            onClick={dismissLevelUp}
          >
            <span>{language === 'vi' ? 'Tiếp Tục Luyện Tập' : 'Keep Practicing'}</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
