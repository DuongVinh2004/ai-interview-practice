import { useQuery } from '@tanstack/react-query';
import { LeaderboardEntryDto } from '@ai-interview/contracts';
import { apiClient } from '../../lib/api-client';
import { useI18nStore } from '../../stores/i18n.store';
import { Spinner } from '../../components/ui/Spinner';
import { Trophy, Flame, Medal, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LeaderboardPage() {
  const { language } = useI18nStore();

  const { data: leaderboard = [], isLoading } = useQuery<LeaderboardEntryDto[]>({
    queryKey: ['gamification', 'leaderboard'],
    queryFn: () => apiClient<LeaderboardEntryDto[]>('/gamification/leaderboard?limit=25'),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">
          {language === 'vi' ? 'Đang tải bảng xếp hạng...' : 'Loading leaderboard...'}
        </p>
      </div>
    );
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-extrabold text-sm shadow-xs border border-amber-300">
          🥇
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-extrabold text-sm shadow-xs border border-slate-300">
          🥈
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-800 flex items-center justify-center font-extrabold text-sm shadow-xs border border-amber-200">
          🥉
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center font-bold text-xs font-mono">
        #{rank}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in" data-testid="leaderboard-page">
      {/* Back button */}
      <Link
        to="/gamification/badges"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{language === 'vi' ? 'Quay lại Bộ Huy Hiệu' : 'Back to Badges'}</span>
      </Link>

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1.5 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-emerald-200 text-xs font-bold uppercase tracking-wider">
            <Trophy className="w-4 h-4" />
            <span>{language === 'vi' ? 'Bảng Vinh Danh Ứng Viên' : 'Candidate Hall of Fame'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {language === 'vi' ? 'Bảng Xếp Hạng Toàn Cầu' : 'Global Leaderboard'}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100 max-w-md">
            {language === 'vi'
              ? 'Tích lũy XP qua các buổi phỏng vấn và duy trì chuỗi học tập để vươn lên đỉnh bảng xếp hạng.'
              : 'Accumulate XP through mock interviews, coding tests, and maintain practice streaks to reach the top.'}
          </p>
        </div>

        <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 text-center border border-white/20">
          <Medal className="w-8 h-8 text-amber-300 mx-auto mb-1" />
          <span className="text-[11px] text-emerald-100 font-medium block">
            {language === 'vi' ? 'Cập nhật thời gian thực' : 'Real-time Ranking'}
          </span>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              {language === 'vi' ? 'Chưa có ứng viên nào trên bảng xếp hạng.' : 'No candidates ranked yet.'}
            </div>
          ) : (
            leaderboard.map(entry => (
              <div
                key={entry.userId}
                className={`flex items-center justify-between p-4 sm:p-5 transition-colors ${
                  entry.isCurrentUser
                    ? 'bg-emerald-50/70 border-l-4 border-l-emerald-600'
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* Left: Rank & User Info */}
                <div className="flex items-center gap-3 sm:gap-4">
                  {getRankBadge(entry.rank)}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm sm:text-base">
                        {entry.displayName}
                      </span>
                      {entry.isCurrentUser && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {language === 'vi' ? 'Bạn' : 'You'}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      Lv.{entry.currentLevel} • {entry.levelTitle}
                    </span>
                  </div>
                </div>

                {/* Right: Streak & XP */}
                <div className="flex items-center gap-4 sm:gap-6">
                  {entry.currentStreak > 0 && (
                    <div
                      className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200"
                      title={`${entry.currentStreak} days streak`}
                    >
                      <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                      <span>{entry.currentStreak}</span>
                    </div>
                  )}

                  <div className="text-right">
                    <span className="text-sm sm:text-base font-extrabold text-emerald-700 font-mono">
                      {entry.totalXp.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold block">XP</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default LeaderboardPage;
