import { useState } from 'react';
import { useSkillGraph } from './useSkillGraph';
import { CompetencyRadarOverlay } from './CompetencyRadarOverlay';
import { SkillTreeView } from './SkillTreeView';
import { ProgressTrendChart } from './ProgressTrendChart';
import { HeatmapCalendar } from './HeatmapCalendar';
import { GapAnalysisCard } from './GapAnalysisCard';
import { Spinner } from '../../components/ui/Spinner';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Award, Zap, GitBranch, TrendingUp, Layers } from 'lucide-react';
import { useI18nStore } from '../../stores/i18n.store';

export function SkillGraphPage() {
  const { language } = useI18nStore();
  const isVi = language === 'vi';

  const [targetRole, setTargetRole] = useState('backend');
  const [targetLevel, setTargetLevel] = useState('senior');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '180d' | '365d'>('30d');

  const { graph, isLoadingGraph, useBenchmark, useProgress, gaps, isLoadingGaps } = useSkillGraph();

  const { data: benchmark } = useBenchmark(targetRole, targetLevel);
  const { data: progressTrend } = useProgress(period);

  if (isLoadingGraph) {
    return (
      <div
        className="flex flex-col items-center justify-center py-24 gap-4"
        data-testid="skills-loading"
      >
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">
          {isVi
            ? 'Đang tải cây kỹ năng & đối chiếu chuẩn ngành...'
            : 'Loading Skill Graph & Benchmarks...'}
        </p>
      </div>
    );
  }

  const radarData =
    graph?.areas.map(a => ({
      area: a.area,
      name: a.name,
      score: a.score,
      benchmarkP50: a.benchmarkP50 || 7.0,
      percentile: a.percentile,
    })) || [];

  const allSubNodes = graph?.areas.flatMap(a => a.subCompetencies) || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto" data-testid="skill-graph-page">
      {/* Top Banner & Profile Overview */}
      <div className="bg-gradient-to-r from-emerald-50/70 via-white to-indigo-50/40 text-slate-900 p-6 sm:p-8 rounded-2xl shadow-xs border border-emerald-100/90 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-100/80 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              {isVi
                ? 'Tổng hợp độ suy giảm theo thời gian (λ = 0.01)'
                : 'Exponential Decay Aggregation (λ = 0.01)'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            {isVi
              ? 'Ma Trận Kỹ Năng & Lỗ Hổng Năng Lực (Skill Graph)'
              : 'Skill Graph & Competency Matrix'}
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm max-w-xl">
            {isVi
              ? 'Theo dõi liên tục chiều sâu kiến thức kỹ thuật qua các mảng Thiết kế hệ thống, Ngôn ngữ lập trình, Cơ sở dữ liệu và Mẫu kiến trúc.'
              : 'Track technical depth continuously across System Design, Core Languages, Databases, and Architecture Patterns.'}
          </p>
        </div>

        {/* Big Score Cards */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-center px-3 border-r border-slate-100">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 block font-bold">
              {isVi ? 'Điểm Tổng Kết' : 'Overall Score'}
            </span>
            <div className="text-3xl font-extrabold text-emerald-700 font-mono mt-0.5">
              {graph?.overallScore.toFixed(1) || '0.0'}
              <span className="text-xs text-slate-400 font-normal font-sans"> / 10</span>
            </div>
          </div>

          <div className="text-center px-3">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 block font-bold">
              {isVi ? 'Xếp Hạng Nhóm' : 'Cohort Rank'}
            </span>
            <div className="text-2xl font-extrabold text-indigo-700 font-mono mt-0.5 flex items-center justify-center gap-1">
              <Award className="w-5 h-5 text-amber-500" />
              <span>Top {100 - (benchmark?.percentileRank || 50)}%</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {benchmark?.cohortSize || 45} {isVi ? 'ứng viên' : 'candidates'}
            </span>
          </div>
        </div>
      </div>

      {/* Role & Seniority Filter Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Layers className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {isVi ? 'Nhóm Đối Chiếu Chuẩn Ngành:' : 'Benchmark Cohort:'}
          </span>
          <div className="flex items-center gap-2">
            <select
              value={targetRole}
              onChange={e => setTargetRole(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="backend">Backend Engineer</option>
              <option value="frontend">Frontend Engineer</option>
              <option value="fullstack">Fullstack Engineer</option>
              <option value="devops">DevOps & Cloud</option>
            </select>

            <select
              value={targetLevel}
              onChange={e => setTargetLevel(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="fresher">Fresher (L2)</option>
              <option value="junior">Junior (L3)</option>
              <option value="mid">Mid-Level (L4)</option>
              <option value="senior">Senior (L5)</option>
              <option value="lead">Staff / Lead (L6)</option>
            </select>
          </div>
        </div>

        <span className="text-xs text-slate-400 italic">
          {isVi ? 'Cập nhật lần cuối: ' : 'Last recalculated: '}
          {new Date(graph?.lastUpdated || Date.now()).toLocaleDateString(isVi ? 'vi-VN' : 'en-US')}
        </span>
      </div>

      {/* Main Grid: Radar & Tree on Left, Trends & Gaps on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Radar Overlay Card */}
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>
                  {isVi ? 'Biểu Đồ Radar Năng Lực Đối Chiếu' : 'Competency Radar vs Benchmark'}
                </span>
                <span className="text-xs font-normal text-slate-500">
                  {isVi ? 'Mục tiêu: ' : 'Target: '}
                  {targetRole.toUpperCase()} ({targetLevel.toUpperCase()})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 flex justify-center">
              <CompetencyRadarOverlay
                data={radarData}
                size={340}
                targetRoleName={`${targetLevel.toUpperCase()} ${targetRole.toUpperCase()}`}
              />
            </CardContent>
          </Card>

          {/* Collapsible 3-Tier Skill Tree */}
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-emerald-600" />
                <span>
                  {isVi ? 'Phân Rã Cây Kỹ Năng 3 Cấp Độ' : '3-Tier Skill Taxonomy Breakdown'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <SkillTreeView nodes={allSubNodes} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Time Series Progress Trend */}
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <span>{isVi ? 'Xu Hướng Tiến Bộ Điểm Số' : 'Score Trajectory Trend'}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ProgressTrendChart
                trends={progressTrend?.trends || []}
                overallDelta={progressTrend?.overallDelta || 0}
                selectedPeriod={period}
                onPeriodChange={setPeriod}
              />
            </CardContent>
          </Card>

          {/* Activity Heatmap */}
          <HeatmapCalendar daysCount={56} />

          {/* Prioritized Remediation Gaps */}
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{isVi ? 'Lỗ Hổng Kỹ Năng Cần Ưu Tiên Bù Đắp' : 'Top Improvement Gaps'}</span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {gaps?.topGaps?.length || 0} {isVi ? 'lỗ hổng' : 'detected'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {isLoadingGaps ? (
                <div className="py-6 text-center">
                  <Spinner size="sm" />
                </div>
              ) : gaps?.topGaps && gaps.topGaps.length > 0 ? (
                gaps.topGaps.map(g => <GapAnalysisCard key={g.skillNodeId} gap={g} />)
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">
                  {isVi
                    ? 'Không phát hiện lỗ hổng năng lực nghiêm trọng nào. Hãy tiếp tục phát huy!'
                    : 'No critical competency gaps detected. Keep up the great work!'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
