import { useState } from 'react';
import { useReadiness } from './useReadiness';
import { ReadinessGauge } from './ReadinessGauge';
import { TierBadge } from './TierBadge';
import { TimeEstimateCard } from './TimeEstimateCard';
import { CompetencyBreakdownTable } from './CompetencyBreakdownTable';
import { MilestoneTimeline } from './MilestoneTimeline';
import { Spinner } from '../../components/ui/Spinner';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Link } from 'react-router-dom';
import { Sparkles, Target, ArrowRight, Layers, BookOpen, CheckCircle2 } from 'lucide-react';
import { useI18nStore } from '../../stores/i18n.store';

export function ReadinessPage() {
  const [role, setRole] = useState('backend');
  const [level, setLevel] = useState('Senior');
  const { dashboard, isLoading, error } = useReadiness(role);
  const { language } = useI18nStore();
  const isVi = language === 'vi';

  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center py-24 gap-4"
        data-testid="readiness-loading"
      >
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">
          {isVi
            ? 'Đang tính toán chỉ số sẵn sàng phỏng vấn và phân tích năng lực thực tế...'
            : 'Calculating interview readiness score and analyzing performance data...'}
        </p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
        {isVi
          ? 'Không thể tải chỉ số sẵn sàng. Vui lòng thử lại sau.'
          : 'Failed to load readiness index. Please try again later.'}
      </div>
    );
  }

  const isHighReadiness = dashboard.readinessScore >= 75;

  return (
    <div className="space-y-6 max-w-7xl mx-auto" data-testid="readiness-page">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/40 text-slate-900 p-6 sm:p-8 rounded-2xl shadow-xs border border-indigo-100/90 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-100/80 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              {isVi ? 'Đánh Giá Chuẩn Hóa Theo Cấp Bậc' : 'Standardized Level Benchmark'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            {isVi ? 'Chỉ Số Sẵn Sàng Phỏng Vấn (Readiness Index)' : 'Interview Readiness Index'}
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm max-w-2xl">
            {isVi ? (
              <>
                Đánh giá toàn diện dựa trên <strong>số lượng bài phỏng vấn</strong> và{' '}
                <strong>điểm chấm thực tế từng câu hỏi</strong> của bạn theo tiêu chuẩn kỹ thuật cấp{' '}
                {level}.
              </>
            ) : (
              <>
                Comprehensive evaluation based on your <strong>interview practice count</strong> and{' '}
                <strong>evaluated turn scores</strong> against {level} engineering standards.
              </>
            )}
          </p>
        </div>

        {/* Current Tier Badge */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
            {isVi ? 'Cấp Bậc Hiện Tại' : 'Current Tier'}
          </span>
          <TierBadge
            tierSlug={dashboard.tier.slug}
            name={dashboard.tier.name}
            nameVi={dashboard.tier.nameVi}
            size="lg"
          />
        </div>
      </div>

      {/* Role & Level Target Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {isVi ? 'Vị Trí Mục Tiêu:' : 'Target Role:'}
            </span>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="backend">Backend Engineer</option>
              <option value="frontend">Frontend Engineer</option>
              <option value="fullstack">Fullstack Engineer</option>
              <option value="devops">DevOps & Cloud Engineer</option>
              <option value="qa">QA Automation Engineer</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {isVi ? 'Cấp Bậc (Level):' : 'Seniority Level:'}
            </span>
            <select
              value={level}
              onChange={e => setLevel(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Junior">{isVi ? 'Junior (0 - 2 năm)' : 'Junior (0 - 2 yrs)'}</option>
              <option value="Mid-Level">
                {isVi ? 'Mid-Level (2 - 4 năm)' : 'Mid-Level (2 - 4 yrs)'}
              </option>
              <option value="Senior">{isVi ? 'Senior (5+ năm)' : 'Senior (5+ yrs)'}</option>
              <option value="Lead/Staff">
                {isVi ? 'Lead / Staff (8+ năm)' : 'Lead / Staff (8+ yrs)'}
              </option>
            </select>
          </div>
        </div>

        <span className="text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
          {isVi ? (
            <>
              Đã ghi nhận <strong>{dashboard.confidenceInterval.evidenceCount} câu hỏi</strong> đánh
              giá thực tế
            </>
          ) : (
            <>
              <strong>{dashboard.confidenceInterval.evidenceCount} evaluated questions</strong>{' '}
              verified
            </>
          )}
        </span>
      </div>

      {/* Main Grid: Gauge & Practice Target on Left (5 cols), Breakdown on Right (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-5 space-y-6">
          {/* Readiness Gauge Card */}
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>
                  {isVi
                    ? `Chỉ Số Sẵn Sàng: ${dashboard.jobRoleName} (${level})`
                    : `Readiness: ${dashboard.jobRoleName} (${level})`}
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {dashboard.readinessScore}% {isVi ? 'Đạt chuẩn' : 'Match'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 flex justify-center">
              <ReadinessGauge
                score={dashboard.readinessScore}
                confidenceLow={dashboard.confidenceInterval.low}
                confidenceHigh={dashboard.confidenceInterval.high}
                size={260}
              />
            </CardContent>
          </Card>

          {/* Practice Progress Card */}
          <TimeEstimateCard
            weeksToNextTier={dashboard.velocity.weeksToNextTier}
            estimatedTargetDate={dashboard.velocity.estimatedTargetDate}
            weeklyRate={dashboard.velocity.weeklyRate}
            currentTierSlug={dashboard.tier.slug}
          />
        </div>

        {/* Right Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Milestones Tracker */}
          <MilestoneTimeline milestones={dashboard.milestones} />

          {/* Competency Fulfillment Table */}
          <CompetencyBreakdownTable items={dashboard.breakdown} />
        </div>
      </div>

      {/* Action Roadmap / Advanced Learning Section */}
      <Card className="shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {isHighReadiness ? (
              <>
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>
                  {isVi
                    ? 'Gợi Ý Chuyên Sâu & Kiến Thức Nâng Cao (Advanced Engineering Mastery)'
                    : 'Advanced Engineering Mastery & Deep Dives'}
                </span>
              </>
            ) : (
              <>
                <Target className="w-4 h-4 text-emerald-600" />
                <span>
                  {isVi
                    ? 'Lộ Trình Trọng Tâm Cải Thiện Điểm Chuẩn'
                    : 'High-Impact Remediation Roadmap'}
                </span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {dashboard.roadmap.map(item => {
              let title = item.actionTitle;
              let desc = item.actionDescription;

              if (!isVi) {
                if (isHighReadiness) {
                  if (item.priority === 1) {
                    title = 'Distributed Architecture & Consensus (Raft/Paxos)';
                    desc =
                      'Master high-throughput system design (>1M QPS) and network partition handling.';
                  } else if (item.priority === 2) {
                    title = 'Advanced Sharding, Partitioning & Isolation Levels';
                    desc =
                      'Practice data conflict resolution, distributed deadlocks, and query optimization.';
                  } else {
                    title = 'Chaos Engineering & Zero-Trust Architecture';
                    desc = 'Prevent cascading failures and design resilient, self-healing systems.';
                  }
                } else {
                  const areaEnMap: Record<string, string> = {
                    SYSTEM_DESIGN: 'System Design & Scalability',
                    LANGUAGE_CORE: 'Core Programming Language',
                    DATABASE_CONCURRENCY: 'Database & Concurrency',
                    ARCHITECTURE_PATTERNS: 'Architecture & Design Patterns',
                    RESILIENCE_SECURITY: 'Security & Fault Tolerance',
                  };
                  title = `Focused Practice: ${areaEnMap[item.area] || item.areaName}`;
                  desc = `Close the ${item.gapScore || 0} pt gap to boost your readiness score.`;
                }
              }

              return (
                <div
                  key={item.priority}
                  className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-colors ${
                    isHighReadiness
                      ? 'bg-indigo-50/30 border-indigo-200/80 hover:bg-indigo-50/60'
                      : 'bg-slate-50 border-slate-200 hover:bg-emerald-50/20 hover:border-emerald-200'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          isHighReadiness
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {isHighReadiness
                          ? isVi
                            ? 'Chủ đề chuyên sâu'
                            : 'Deep Dive'
                          : isVi
                            ? `Ưu tiên #${item.priority}`
                            : `Priority #${item.priority}`}
                      </span>
                      <span className="text-xs font-bold text-emerald-700">
                        +{item.impactScore} {isVi ? 'điểm tác động' : 'pt impact'}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">{title}</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{desc}</p>
                  </div>

                  <Link to="/interviews/new" className="block pt-2">
                    <Button
                      variant={isHighReadiness ? 'primary' : 'outline'}
                      size="sm"
                      className="w-full text-xs gap-1.5"
                    >
                      <span>
                        {isHighReadiness
                          ? isVi
                            ? 'Luyện Chuyên Sâu'
                            : 'Master Deep Dive'
                          : isVi
                            ? 'Luyện tập ngay'
                            : 'Practice Gap'}
                      </span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Metric Transparency Card */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 text-slate-700 text-xs shadow-2xs">
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
        <div>
          <span className="font-bold text-slate-900 block mb-0.5">
            {isVi ? 'Tính Minh Bạch Của Chỉ Số:' : 'Metric Transparency:'}
          </span>
          <p className="text-slate-600 leading-relaxed">
            {isVi
              ? 'Chỉ số trên bảng này được tính toán 100% dựa trên câu trả lời thực tế và điểm đánh giá AI của bạn trong các phiên phỏng vấn thử. Khi bạn chưa có phiên phỏng vấn nào, điểm số sẽ khởi đầu từ 0% và tăng dần theo năng lực thực chiến được ghi nhận.'
              : 'The readiness index is computed 100% from your actual responses and AI evaluations across mock interview sessions. For new accounts with zero turns, scores start at 0% and dynamically scale with your practice performance.'}
          </p>
        </div>
      </div>
    </div>
  );
}
