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
import { Sparkles, Target, ArrowRight, Info, Layers, ShieldCheck } from 'lucide-react';

export function ReadinessPage() {
  const [role, setRole] = useState('backend');
  const { dashboard, isLoading, error } = useReadiness(role);

  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center py-24 gap-4"
        data-testid="readiness-loading"
      >
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">
          Calculating AI Interview Readiness Score & Offer Predictor...
        </p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
        Failed to load readiness index. Please try again later.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto" data-testid="readiness-page">
      {/* Formative Practice Disclaimer Alert */}
      <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl flex items-center gap-3 text-xs text-emerald-900 shadow-xs">
        <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
        <p>
          Mô hình dự báo năng lực phỏng vấn mang tính định hướng học tập cá nhân, hỗ trợ bạn lập kế
          hoạch ôn tập hiệu quả trước các vòng tuyển dụng thực tế.
        </p>
      </div>

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-500/20 text-indigo-300 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-500/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Composite Offer Predictor Engine (F009)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            AI Interview Readiness Score
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-xl">
            Mathematical modeling of technical competency fulfillment, velocity trajectory, and
            hiring tier probabilities.
          </p>
        </div>

        {/* Current Tier Badge */}
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 flex flex-col items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">
            Assigned Candidate Tier
          </span>
          <TierBadge
            tierSlug={dashboard.tier.slug}
            name={dashboard.tier.name}
            nameVi={dashboard.tier.nameVi}
            size="lg"
          />
        </div>
      </div>

      {/* Role Target Switcher */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Target Job Profile:
          </span>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="backend">Senior Backend Engineer</option>
            <option value="frontend">Frontend Engineer</option>
            <option value="fullstack">Fullstack Engineer</option>
            <option value="devops">DevOps & Cloud Engineer</option>
            <option value="qa">QA Automation Engineer</option>
          </select>
        </div>

        <span className="text-xs font-medium text-slate-500 hidden sm:inline">
          {dashboard.confidenceInterval.evidenceCount} verified turn evaluations
        </span>
      </div>

      {/* Main Grid: Gauge & Time Forecast on Left (5 cols), Breakdown on Right (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-5 space-y-6">
          {/* Readiness Gauge Card */}
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Overall Readiness Index</span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {dashboard.readinessScore}% Match
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

          {/* Time Forecast */}
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

      {/* Prioritized Action Roadmap */}
      <Card className="shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600" />
            <span>High-Impact Remediation Roadmap</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {dashboard.roadmap.map(item => (
              <div
                key={item.priority}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3 hover:bg-emerald-50/20 hover:border-emerald-200 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                      Priority #{item.priority}
                    </span>
                    <span className="text-xs font-bold text-emerald-700">
                      +{item.impactScore} pt impact
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">{item.actionTitle}</h4>
                  <p className="text-[11px] text-slate-600">{item.actionDescription}</p>
                </div>

                <Link to="/interviews/new" className="block pt-2">
                  <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
                    <span>Practice Gap</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mandatory Regulatory & Prediction Disclaimer */}
      <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-xs shadow-2xs">
        <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <span className="font-bold block mb-0.5">Lưu ý / Disclaimer:</span>
          <span>{dashboard.disclaimer}</span>
        </div>
      </div>
    </div>
  );
}
