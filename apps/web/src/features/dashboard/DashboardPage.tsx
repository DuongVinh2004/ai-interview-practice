import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth.store';
import { useI18nStore } from '../../stores/i18n.store';
import { useGamificationStore } from '../../stores/gamification.store';
import { useBilling } from '../../hooks/useBilling';
import { getNextUpgradePlan } from '../../lib/plan-tier.utils';
import { Button } from '../../components/ui/Button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { CompetencyRadarChart } from '../../components/analytics/CompetencyRadarChart';
import { ProgressTrendChart } from '../../components/analytics/ProgressTrendChart';
import {
  PlayCircle,
  History,
  Sparkles,
  Award,
  TrendingUp,
  Target,
  Zap,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Compass,
  FileCheck,
  Crown,
  Flame,
  Trophy,
  Code,
  Mic,
} from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuthStore();
  const { t, language } = useI18nStore();
  const { profile } = useGamificationStore();
  const { subscription } = useBilling();

  const isAdmin = user?.role === 'ADMIN';
  const planSlug = subscription?.plan?.slug?.toLowerCase() || 'free';
  const upgradeSuggestion = getNextUpgradePlan(planSlug, isAdmin, language === 'vi');

  const { data: radarData, isLoading: isLoadingRadar } = useQuery<any>({
    queryKey: ['analytics-competency-radar'],
    queryFn: () => apiClient('/analytics/competency-radar'),
  });

  const { data: progressData, isLoading: isLoadingProgress } = useQuery<any>({
    queryKey: ['analytics-progress'],
    queryFn: () => apiClient('/analytics/progress'),
  });

  const isFirstTimeUser =
    Number(radarData?.totalEvaluatedTurns || 0) === 0 &&
    (!progressData?.sessions || progressData.sessions.length === 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Hero Banner - Luminous Elegant Cyber Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60 text-slate-900 rounded-3xl p-6 sm:p-9 shadow-sm border border-emerald-200/90">
        {/* Soft emerald & teal ambient light glows */}
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#10b98115_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none opacity-80" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Heading, Subtitle & Action CTAs (8 cols on lg) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Live AI Pulse Chip */}
            <div className="inline-flex items-center gap-2 bg-emerald-100/90 border border-emerald-300/80 text-emerald-800 text-xs font-bold px-3.5 py-1 rounded-full shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <span>AI Technical Interview Simulator • Adaptive Engine</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              {language === 'vi' ? 'Chào mừng trở lại, ' : 'Welcome back, '}
              <span className="text-emerald-700 bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-transparent">
                {user?.profile?.fullName || user?.email?.split('@')[0]}!
              </span>
            </h1>

            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-2xl font-normal">
              {language === 'vi'
                ? 'Luyện tập phỏng vấn kỹ thuật IT với hệ thống AI thích ứng độ khó thời gian thực, live coding sandbox và đánh giá chuẩn khung STAR.'
                : 'Sharpen your technical interview readiness with 5-turn adaptive mock sessions tailored to your target engineering seniority and technology stack.'}
            </p>

            {/* Feature Highlights Pills */}
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-semibold text-slate-700">
              <span className="px-3 py-1 rounded-full bg-white/95 border border-emerald-200/80 text-slate-700 shadow-2xs flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-emerald-600" /> Live Code Sandbox
              </span>
              <span className="px-3 py-1 rounded-full bg-white/95 border border-emerald-200/80 text-slate-700 shadow-2xs flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-teal-600" /> Real-time Voice AI
              </span>
              <span className="px-3 py-1 rounded-full bg-white/95 border border-emerald-200/80 text-slate-700 shadow-2xs flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-700" /> STAR Evaluation
              </span>
            </div>

            {/* Action Buttons Row */}
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <Link to="/interviews/new">
                <Button
                  size="lg"
                  variant="primary"
                  className="gap-2 font-bold shadow-md shadow-emerald-600/20 bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-105 active:scale-95 transition-all"
                  leftIcon={<PlayCircle className="h-5 w-5" />}
                >
                  <span>{language === 'vi' ? 'Bắt đầu Phỏng vấn Mới' : 'Start New Interview'}</span>
                </Button>
              </Link>

              <Link to="/readiness">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-bold shadow-2xs hover:scale-105 active:scale-95 transition-all"
                  leftIcon={<Target className="h-4 w-4 text-emerald-600" />}
                >
                  <span>{language === 'vi' ? 'Xem Chỉ số Sẵn sàng' : 'Check Readiness'}</span>
                </Button>
              </Link>

              {/* Dynamic Next Higher Tier Upgrade Button (or VIP Badge when on highest tier) */}
              {upgradeSuggestion.hasHigherPlan ? (
                <Link to={`/pricing?plan=${upgradeSuggestion.targetPlanSlug}`}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 h-11 px-4 rounded-xl text-xs font-bold text-amber-900 bg-gradient-to-r from-amber-100 via-amber-50 to-emerald-50 border border-amber-300 hover:border-amber-400 hover:shadow-xs transition-all active:scale-95 group cursor-pointer"
                    title={upgradeSuggestion.headerPillLabel}
                  >
                    <Crown className="w-4 h-4 text-amber-600 group-hover:scale-110 group-hover:rotate-6 transition-transform" />
                    <span>{upgradeSuggestion.buttonLabel}</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  </button>
                </Link>
              ) : (
                <div
                  className="inline-flex items-center gap-2 h-11 px-4 rounded-xl text-xs font-extrabold text-purple-900 bg-purple-50 border border-purple-200 shadow-2xs select-none"
                  title="Tài khoản sở hữu quyền lợi cao nhất của hệ thống"
                >
                  <Crown className="w-4 h-4 text-purple-600" />
                  <span>{isAdmin ? 'Quyền Lợi Quản Trị Viên' : 'Gói Doanh Nghiệp VIP'}</span>
                  <span className="text-[9px] bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded font-mono font-bold">
                    MAX TIER
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Mini HUD Glass Widget (4 cols on lg) */}
          <div className="hidden lg:flex lg:col-span-4 flex-col gap-3 p-4 rounded-2xl bg-white/80 border border-emerald-100/90 shadow-sm backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-extrabold text-slate-800">
                  {profile
                    ? `Lv.${profile.currentLevel} • ${language === 'vi' ? profile.levelTitleVi : profile.levelTitle}`
                    : 'Cấp độ ứng viên'}
                </span>
              </div>
              {profile && (
                <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  {profile.totalXp} XP
                </span>
              )}
            </div>

            {profile && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                  <span>Tiến độ lên Lv.{profile.currentLevel + 1}</span>
                  <span>{profile.levelProgressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-0.5 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(4, profile.levelProgressPercent))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-orange-50/80 border border-orange-200/80 flex flex-col">
                <div className="flex items-center gap-1.5 text-[11px] text-orange-800 font-bold">
                  <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
                  <span>Chuỗi</span>
                </div>
                <span className="text-lg font-black text-orange-950 mt-0.5">
                  {profile?.streak?.currentStreak || 0}{' '}
                  <span className="text-xs font-normal text-orange-800">ngày</span>
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 flex flex-col">
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-bold">
                  <Zap className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Lượt đã tập</span>
                </div>
                <span className="text-lg font-black text-emerald-950 mt-0.5">
                  {progressData?.sessions?.length || 0}{' '}
                  <span className="text-xs font-normal text-emerald-800">buổi</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FIRST-TIME CANDIDATE ONBOARDING EMPTY STATE */}
      {isFirstTimeUser && (
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-indigo-50/30 shadow-md p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-emerald-100 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  {language === 'vi'
                    ? '3 Bước Khởi Đầu Luyện Tập'
                    : '3 Steps to Master Your Practice'}
                </h3>
              </div>
              <p className="text-xs text-slate-600">
                {language === 'vi'
                  ? 'Quy trình đơn giản, hiệu quả giúp bạn làm quen và tự tin trước kỳ phỏng vấn'
                  : 'A streamlined workflow designed to build interview reflexes and confidence'}
              </p>
            </div>
            <Link to="/interviews/new">
              <Button size="md" variant="primary" leftIcon={<PlayCircle className="h-4 w-4" />}>
                <span>{language === 'vi' ? 'Bắt đầu Lượt Đầu Tiên' : 'Launch First Session'}</span>
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                1
              </div>
              <h4 className="font-bold text-sm text-slate-900">
                {language === 'vi' ? 'Chọn Mục Tiêu Nghề Nghiệp' : 'Set Your Target Stack'}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {language === 'vi'
                  ? 'Lựa chọn vị trí (Frontend, Backend, Fullstack), cấp bậc và 1-5 công nghệ trọng tâm.'
                  : 'Pick your engineering track, seniority, and up to 5 core technologies.'}
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center justify-center">
                2
              </div>
              <h4 className="font-bold text-sm text-slate-900">
                {language === 'vi' ? 'Trả Lời 5 Câu Hỏi Thích Ứng' : 'Answer 5 Adaptive Questions'}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {language === 'vi'
                  ? 'AI tự động điều chỉnh độ khó Dễ / Vừa / Khó theo chất lượng câu trả lời của bạn.'
                  : 'AI orchestrator dynamically scales difficulty based on your explanation depth.'}
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="h-7 w-7 rounded-lg bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center">
                3
              </div>
              <h4 className="font-bold text-sm text-slate-900">
                {language === 'vi' ? 'Nhận Lộ Trình Cải Thiện' : 'Personalized Remediation'}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {language === 'vi'
                  ? 'Nhận báo cáo phân tích rubric 3 chiều, trích dẫn bằng chứng và danh sách chủ đề cần ôn tập.'
                  : 'Review deterministic rubric scoring, evidence quotes, and targeted flashcards.'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Launch Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/interviews/new" className="group">
          <Card className="h-full border-slate-200 hover:border-emerald-500/50 hover:shadow-md transition-all">
            <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <PlayCircle className="h-5 w-5" />
                </div>
                <Badge variant="success" className="text-[10px]">
                  {language === 'vi' ? 'Trực tiếp' : 'Live Mock'}
                </Badge>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-emerald-600 transition-colors">
                  {language === 'vi' ? 'Phỏng vấn Kỹ thuật' : 'Technical Coding'}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {language === 'vi'
                    ? '5 câu hỏi thích ứng độ khó kèm code sandbox'
                    : '5-question adaptive interview with sandbox'}
                </p>
              </div>
              <div className="flex items-center text-xs font-semibold text-emerald-600 group-hover:translate-x-0.5 transition-transform">
                <span>{language === 'vi' ? 'Bắt đầu ngay' : 'Start session'}</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/flashcards" className="group">
          <Card className="h-full border-slate-200 hover:border-indigo-500/50 hover:shadow-md transition-all">
            <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <BookOpen className="h-5 w-5" />
                </div>
                <Badge variant="indigo" className="text-[10px]">
                  {language === 'vi' ? 'Ôn tập' : 'Daily Drill'}
                </Badge>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {language === 'vi' ? 'Bộ Thẻ Flashcards' : 'Flashcard Decks'}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {language === 'vi'
                    ? 'Ôn phản xạ kiến thức theo thuật toán ngắt quãng'
                    : 'Active recall drill with spaced repetition'}
                </p>
              </div>
              <div className="flex items-center text-xs font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                <span>{language === 'vi' ? 'Luyện thẻ' : 'Review cards'}</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/skills" className="group">
          <Card className="h-full border-slate-200 hover:border-purple-500/50 hover:shadow-md transition-all">
            <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Award className="h-5 w-5" />
                </div>
                <Badge variant="purple" className="text-[10px]">
                  {language === 'vi' ? 'Năng lực' : 'Matrix'}
                </Badge>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-purple-600 transition-colors">
                  {language === 'vi' ? 'Cây Kỹ Năng & Lỗ Hổng' : 'Skill Graph & Gaps'}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {language === 'vi'
                    ? 'Nhận diện điểm mạnh và lỗ hổng kiến thức cần bù đắp'
                    : 'Analyze skill distribution and priority gaps'}
                </p>
              </div>
              <div className="flex items-center text-xs font-semibold text-purple-600 group-hover:translate-x-0.5 transition-transform">
                <span>{language === 'vi' ? 'Xem ma trận' : 'Explore graph'}</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/history" className="group">
          <Card className="h-full border-slate-200 hover:border-slate-400/50 hover:shadow-md transition-all">
            <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <History className="h-5 w-5" />
                </div>
                <Badge variant="default" className="text-[10px]">
                  {language === 'vi' ? 'Lưu trữ' : 'Records'}
                </Badge>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-slate-700 transition-colors">
                  {language === 'vi' ? 'Lịch Sử & Đánh Giá' : 'Past Reports & Feedback'}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {language === 'vi'
                    ? 'Xem lại bảng điểm, nhận xét AI và lộ trình học tập'
                    : 'Review transcripts, AI feedback, and learning path'}
                </p>
              </div>
              <div className="flex items-center text-xs font-semibold text-slate-700 group-hover:translate-x-0.5 transition-transform">
                <span>{language === 'vi' ? 'Xem lịch sử' : 'View history'}</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Analytics & Competency Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Competency Radar Card */}
        <Card className="border-slate-200 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base font-bold">
                  {t.analytics.competencyRadarTitle}
                </CardTitle>
              </div>
              {radarData?.totalEvaluatedTurns > 0 && (
                <Badge variant="success" className="text-[10px]">
                  {radarData.totalEvaluatedTurns}{' '}
                  {language === 'vi' ? 'lượt đã chấm' : 'turns evaluated'}
                </Badge>
              )}
            </div>
            <CardDescription>{t.analytics.competencyRadarSubtitle}</CardDescription>
          </CardHeader>

          <CardContent className="pt-2 flex flex-col items-center justify-center flex-1">
            {isLoadingRadar ? (
              <div className="py-20 flex flex-col items-center gap-2">
                <Skeleton variant="circular" width={180} height={180} />
                <span className="text-xs text-slate-400 mt-2">Loading radar data...</span>
              </div>
            ) : radarData?.competencies?.length > 0 ? (
              <div className="w-full flex flex-col items-center space-y-4">
                <CompetencyRadarChart competencies={radarData.competencies} size={280} />

                {/* Strengths & Growth Areas Action Cards */}
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/40 p-3.5 rounded-2xl border border-emerald-200/80 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-emerald-600" />
                          {t.analytics.topStrengths}
                        </span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                          {language === 'vi' ? 'Vững vàng' : 'Solid'}
                        </span>
                      </div>
                      {radarData.topStrengths?.length > 0 ? (
                        <ul className="space-y-1.5 text-emerald-900 text-[11px] font-medium">
                          {radarData.topStrengths.map((s: string) => (
                            <li key={s} className="flex items-center gap-1.5 truncate">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">{s}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-emerald-700">
                          {language === 'vi'
                            ? 'Hoàn thành thêm lượt để mở khóa phân tích'
                            : 'Complete more sessions to unlock analytics'}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-emerald-700/80 font-medium pt-2 mt-auto">
                      {language === 'vi'
                        ? 'Duy trì phong độ xuất sắc'
                        : 'Keep up the strong execution'}
                    </span>
                  </div>

                  <div className="bg-gradient-to-br from-amber-50/90 to-orange-50/40 p-3.5 rounded-2xl border border-amber-200/80 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-amber-950 flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
                          {t.analytics.growthAreas}
                        </span>
                        <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                          {language === 'vi' ? 'Cần cải thiện' : 'Priority'}
                        </span>
                      </div>
                      {radarData.growthAreas?.length > 0 ? (
                        <ul className="space-y-1.5 text-amber-900 text-[11px] font-medium">
                          {radarData.growthAreas.map((g: string) => (
                            <li key={g} className="flex items-center gap-1.5 truncate">
                              <Target className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="truncate">{g}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-amber-700">
                          {language === 'vi'
                            ? 'Không phát hiện lỗ hổng lớn'
                            : 'No major gaps detected'}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 mt-auto flex items-center justify-between">
                      <Link
                        to="/flashcards"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-950 bg-amber-200/70 hover:bg-amber-300 px-2.5 py-1 rounded-xl transition-all shadow-2xs hover:scale-105 active:scale-95"
                      >
                        <Sparkles className="w-3 h-3 text-amber-800" />
                        <span>{language === 'vi' ? 'Ôn tập ngay' : 'Practice Flashcards'}</span>
                        <ArrowRight className="w-3 h-3 text-amber-800" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 space-y-3">
                <Target className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-400 max-w-xs mx-auto">{t.analytics.noDataYet}</p>
                <Link to="/interviews/new">
                  <Button size="sm" variant="primary">
                    {language === 'vi' ? 'Bắt đầu Lượt Đầu Tiên' : 'Start First Session'}
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress Trends Card */}
        <Card className="border-slate-200 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-base font-bold">{t.analytics.progressTitle}</CardTitle>
            </div>
            <CardDescription>{t.analytics.progressSubtitle}</CardDescription>
          </CardHeader>

          <CardContent className="pt-2 flex-1 flex flex-col justify-center">
            {isLoadingProgress ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <Skeleton variant="rectangular" height={160} />
                <span className="text-xs text-slate-400 mt-2">Loading progress trend...</span>
              </div>
            ) : progressData?.sessions?.length > 0 ? (
              <ProgressTrendChart
                sessions={progressData.sessions}
                averageScore={progressData.averageScore}
                highestScore={progressData.highestScore}
                scoreVelocity={progressData.scoreVelocity}
              />
            ) : (
              <div className="text-center py-16 space-y-3">
                <TrendingUp className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-400 max-w-xs mx-auto">{t.analytics.noDataYet}</p>
                <Link to="/interviews/new">
                  <Button size="sm" variant="secondary">
                    {language === 'vi' ? 'Luyện tập Ngay' : 'Start Practice'}
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Value Proposition Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="border-slate-200">
          <CardContent className="p-5 space-y-2">
            <div className="bg-emerald-100 text-emerald-800 p-2 rounded-xl w-fit">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">
              {language === 'vi' ? 'AI Thích Ứng Độ Khó' : 'Adaptive Difficulty Engine'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {language === 'vi'
                ? 'Độ khó câu hỏi tự động điều chỉnh linh hoạt theo chất lượng câu trả lời thực tế của bạn.'
                : 'Questions dynamically adjust between Easy, Medium, and Hard based on your real-time answer quality.'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5 space-y-2">
            <div className="bg-blue-100 text-blue-800 p-2 rounded-xl w-fit">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">
              {language === 'vi' ? 'Rubric Đánh Giá Chuẩn Hóa' : 'Structured Rubric Scoring'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {language === 'vi'
                ? 'Chấm điểm minh bạch theo độ chính xác kỹ thuật, chiều sâu và trích dẫn bằng chứng nguyên văn.'
                : 'Evaluated on technical accuracy, depth, and clarity with specific quoted evidence identified.'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5 space-y-2">
            <div className="bg-purple-100 text-purple-800 p-2 rounded-xl w-fit">
              <FileCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">
              {language === 'vi' ? 'Lộ Trình Học Tập Cá Nhân Hóa' : 'Custom Action Roadmap'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {language === 'vi'
                ? 'Đề xuất chủ đề ôn tập ưu tiên và từ khóa tra cứu để bù đắp lỗ hổng kiến thức sau mỗi phiên.'
                : 'Targeted skill gap analysis and prioritized learning recommendations after completing all 5 turns.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DashboardPage;
