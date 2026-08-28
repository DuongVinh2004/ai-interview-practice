import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeDto } from '@ai-interview/contracts';
import { apiClient } from '../../lib/api-client';
import { useI18nStore } from '../../stores/i18n.store';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Award, Lock, Trophy, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function BadgesShowcasePage() {
  const { language } = useI18nStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const { data: badges = [], isLoading } = useQuery<BadgeDto[]>({
    queryKey: ['gamification', 'badges'],
    queryFn: () => apiClient<BadgeDto[]>('/gamification/badges'),
  });

  const categories = [
    { key: 'ALL', label: language === 'vi' ? 'Tất cả' : 'All Badges' },
    { key: 'INTERVIEW', label: language === 'vi' ? 'Phỏng vấn' : 'Interview' },
    { key: 'STREAK', label: language === 'vi' ? 'Chuỗi ngày' : 'Streak' },
    { key: 'LEARNING', label: language === 'vi' ? 'Ôn tập' : 'Learning' },
    { key: 'CODING', label: language === 'vi' ? 'Lập trình' : 'Coding' },
  ];

  const filteredBadges =
    selectedCategory === 'ALL' ? badges : badges.filter(b => b.category === selectedCategory);

  const unlockedCount = badges.filter(b => b.isUnlocked).length;
  const totalCount = badges.length;
  const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">
          {language === 'vi' ? 'Đang tải bộ sưu tập huy hiệu...' : 'Loading badges collection...'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto" data-testid="badges-showcase-page">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-10 shadow-xl border border-emerald-900/50">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Trophy className="w-4 h-4" />
              <span>
                {language === 'vi'
                  ? 'Hệ thống Thành tựu & Huy hiệu'
                  : 'Achievements & Badges System'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              {language === 'vi' ? 'Bộ Sưu Tập Huy Hiệu' : 'Badge Showcase'}
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              {language === 'vi'
                ? 'Mở khóa các mốc thành tựu khi hoàn thành phỏng vấn, giải thuật coding, ôn tập flashcards và duy trì chuỗi học tập.'
                : 'Unlock prestigious achievements by acing mock interviews, passing coding sandbox tests, reviewing flashcards, and maintaining practice streaks.'}
            </p>
          </div>

          {/* Progress Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 text-center min-w-[200px] shrink-0">
            <span className="text-xs font-semibold text-emerald-300 block mb-1">
              {language === 'vi' ? 'Tiến độ mở khóa' : 'Unlocked Progress'}
            </span>
            <div className="text-3xl font-extrabold text-white font-mono">
              {unlockedCount} / {totalCount}
            </div>
            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden mt-3">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-300 mt-1 block">
              {progressPercent}% {language === 'vi' ? 'Hoàn thành' : 'Completed'}
            </span>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {categories.map(cat => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === cat.key
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <Link
          to="/gamification/leaderboard"
          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5"
        >
          <Award className="w-4 h-4" />
          <span>{language === 'vi' ? 'Xem Bảng Xếp Hạng Top Candidates' : 'View Leaderboard'}</span>
        </Link>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {filteredBadges.map(badge => {
          const badgeName = language === 'vi' ? badge.nameVi : badge.name;
          const badgeDesc = language === 'vi' ? badge.descriptionVi : badge.description;

          return (
            <Card
              key={badge.id}
              className={`transition-all hover:shadow-md ${
                badge.isUnlocked
                  ? 'border-emerald-200 bg-white'
                  : 'border-slate-200 bg-slate-50/70 opacity-75'
              }`}
            >
              <CardContent className="p-6 text-center space-y-4">
                {/* Badge Icon */}
                <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                  {badge.isUnlocked ? (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center text-3xl shadow-md border-2 border-white">
                      {badge.iconUrl}
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-slate-200 text-slate-400 flex items-center justify-center text-3xl border border-slate-300">
                      <Lock className="w-7 h-7 text-slate-400" />
                    </div>
                  )}

                  {badge.isUnlocked && (
                    <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-600 text-white rounded-full shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-bold text-slate-900 text-sm">{badgeName}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed min-h-[38px]">{badgeDesc}</p>
                </div>

                <div className="pt-2 flex items-center justify-center gap-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                    +{badge.xpReward} XP
                  </span>

                  {badge.isUnlocked ? (
                    <Badge variant="success" className="text-[10px]">
                      {language === 'vi' ? 'Đã đạt' : 'Unlocked'}
                    </Badge>
                  ) : (
                    <Badge variant="default" className="text-[10px] text-slate-400 bg-slate-200">
                      {language === 'vi' ? 'Chưa mở' : 'Locked'}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default BadgesShowcasePage;
