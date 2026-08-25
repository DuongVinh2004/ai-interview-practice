import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth.store';
import { useI18nStore } from '../../stores/i18n.store';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
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
  Shield,
} from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuthStore();
  const { t, language } = useI18nStore();

  const { data: radarData, isLoading: isLoadingRadar } = useQuery<any>({
    queryKey: ['analytics-competency-radar'],
    queryFn: () => apiClient('/analytics/competency-radar'),
  });

  const { data: progressData, isLoading: isLoadingProgress } = useQuery<any>({
    queryKey: ['analytics-progress'],
    queryFn: () => apiClient('/analytics/progress'),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-lg border border-slate-700/50">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Technical Interview Simulator</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            {language === 'vi' ? 'Chào mừng trở lại, ' : 'Welcome back, '}
            <span className="text-emerald-400">
              {user?.profile?.fullName || user?.email?.split('@')[0]}!
            </span>
          </h1>

          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-xl">
            {language === 'vi'
              ? 'Luyện tập phỏng vấn kỹ thuật IT với hệ thống AI thích ứng độ khó thời gian thực, live coding sandbox và đánh giá chuẩn khung STAR.'
              : 'Sharpen your technical interview readiness with 5-turn adaptive mock sessions tailored to your target engineering seniority and technology stack.'}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link to="/interviews/new">
              <Button
                size="lg"
                variant="primary"
                className="gap-2 font-bold shadow-md bg-emerald-500 hover:bg-emerald-600 text-slate-950"
                leftIcon={<PlayCircle className="h-5 w-5" />}
              >
                <span>{language === 'vi' ? 'Bắt đầu Phỏng vấn Mới' : 'Start New Interview'}</span>
              </Button>
            </Link>
            <Link to="/readiness">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 bg-slate-800/80 border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
                leftIcon={<Target className="h-4 w-4 text-amber-400" />}
              >
                <span>{language === 'vi' ? 'Xem Chỉ số Sẵn sàng' : 'Check Readiness'}</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-32 -bottom-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

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
                <Spinner size="md" />
                <span className="text-xs text-slate-400">Loading radar data...</span>
              </div>
            ) : radarData?.competencies?.length > 0 ? (
              <div className="w-full flex flex-col items-center space-y-4">
                <CompetencyRadarChart competencies={radarData.competencies} size={280} />

                {/* Strengths & Growth Areas */}
                <div className="w-full grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
                    <span className="font-bold text-emerald-900 flex items-center gap-1 mb-1.5">
                      <Zap className="h-3.5 w-3.5 text-emerald-600" />
                      {t.analytics.topStrengths}
                    </span>
                    {radarData.topStrengths?.length > 0 ? (
                      <ul className="list-disc list-inside text-emerald-800 space-y-1 text-[11px]">
                        {radarData.topStrengths.map((s: string) => (
                          <li key={s} className="truncate">{s}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-emerald-600">
                        {language === 'vi' ? 'Hoàn thành thêm lượt để mở khóa' : 'Complete more sessions'}
                      </p>
                    )}
                  </div>

                  <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-100">
                    <span className="font-bold text-amber-900 flex items-center gap-1 mb-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
                      {t.analytics.growthAreas}
                    </span>
                    {radarData.growthAreas?.length > 0 ? (
                      <ul className="list-disc list-inside text-amber-800 space-y-1 text-[11px]">
                        {radarData.growthAreas.map((g: string) => (
                          <li key={g} className="truncate">{g}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-amber-600">
                        {language === 'vi' ? 'Không phát hiện lỗ hổng lớn' : 'No major gaps detected'}
                      </p>
                    )}
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
              <CardTitle className="text-base font-bold">
                {t.analytics.progressTitle}
              </CardTitle>
            </div>
            <CardDescription>{t.analytics.progressSubtitle}</CardDescription>
          </CardHeader>

          <CardContent className="pt-2 flex-1 flex flex-col justify-center">
            {isLoadingProgress ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <Spinner size="md" />
                <span className="text-xs text-slate-400">Loading progress trend...</span>
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

      {/* Highlights / Features Banner */}
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
              <Shield className="h-5 w-5" />
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
