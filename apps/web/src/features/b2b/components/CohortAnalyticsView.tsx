import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { CohortAnalyticsDto } from '@ai-interview/contracts';
import {
  BarChart3,
  Users,
  AlertTriangle,
  Award,
  Layers,
} from 'lucide-react';

interface CohortAnalyticsViewProps {
  cohortId: string;
}

export const CohortAnalyticsView: React.FC<CohortAnalyticsViewProps> = ({ cohortId }) => {
  const { data: analytics, isLoading } = useQuery<CohortAnalyticsDto>({
    queryKey: ['cohort-analytics', cohortId],
    queryFn: async () => {
      const res = await apiClient.get<CohortAnalyticsDto>(`/b2b/analytics/cohort/${cohortId}`);
      return res.data;
    },
    enabled: !!cohortId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse" data-testid="analytics-loading">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  if (!analytics) return null;

  const dist = analytics.scoreDistribution;
  const maxBracketCount = Math.max(
    dist.bracket0to4,
    dist.bracket4to6,
    dist.bracket6to8,
    dist.bracket8to10,
    1,
  );

  return (
    <div className="space-y-8" data-testid="cohort-analytics-view">
      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Enrolled Students</span>
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 block">
            {analytics.totalStudents}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <Users className="h-3 w-3" /> {analytics.activeStudents} active learners
          </span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Cohort Average Score</span>
          <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-1 block">
            {analytics.overallAverageScore.toFixed(1)}{' '}
            <span className="text-sm font-normal text-slate-400">/ 10</span>
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Benchmark accuracy</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Completion Rate</span>
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 block">
            {analytics.completionRate}%
          </span>
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${analytics.completionRate}%` }}
            />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Top Performers</span>
          <span className="text-2xl sm:text-3xl font-extrabold text-indigo-600 mt-1 block">
            {analytics.topPerformers.length}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <Award className="h-3 w-3 text-indigo-500" /> Score ≥ 8.0
          </span>
        </div>
      </div>

      {/* Score Distribution Chart & Skill Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Distribution Bars */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-base text-slate-900">Score Distribution</h3>
              <p className="text-xs text-slate-500">Student performance brackets across completed turns</p>
            </div>
          </div>

          <div className="space-y-3.5">
            {[
              { label: '8.0 – 10.0 (Mastery)', count: dist.bracket8to10, color: 'bg-emerald-500' },
              { label: '6.0 – 7.9 (Competitive)', count: dist.bracket6to8, color: 'bg-teal-500' },
              { label: '4.0 – 5.9 (Growing)', count: dist.bracket4to6, color: 'bg-amber-500' },
              { label: '0.0 – 3.9 (Needs Remediation)', count: dist.bracket0to4, color: 'bg-rose-500' },
            ].map((bracket) => (
              <div key={bracket.label} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>{bracket.label}</span>
                  <span>{bracket.count} students</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${bracket.color}`}
                    style={{ width: `${(bracket.count / maxBracketCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5-Axis Competency Skill Heatmap */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm" data-testid="skill-heatmap">
          <div className="flex items-center gap-2 mb-6">
            <Layers className="h-5 w-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-base text-slate-900">Competency Skill Heatmap</h3>
              <p className="text-xs text-slate-500">Cohort-wide strengths & learning gap indicators</p>
            </div>
          </div>

          <div className="space-y-4">
            {analytics.skillHeatmap.map((item) => (
              <div key={item.competencyArea} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-slate-800">{item.areaName}</span>
                  <span className="text-xs font-extrabold text-emerald-700">
                    {item.averageScore.toFixed(1)}/10 ({item.passingRate}% pass)
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    style={{ width: `${Math.min(item.averageScore * 10, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>Weakness: <strong className="text-slate-700">{item.weakestTopic}</strong></span>
                  <span>Strength: <strong className="text-slate-700">{item.strongestTopic}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lists: Needing Help vs Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students Needing Assistance */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Students Needing Remediation
          </h3>

          <div className="divide-y divide-slate-100">
            {analytics.studentsNeedingHelp.length > 0 ? (
              analytics.studentsNeedingHelp.map((student) => (
                <div key={student.userId} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{student.fullName}</p>
                    <p className="text-xs text-slate-400">{student.email}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                      Avg: {student.averageScore.toFixed(1)}/10
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {student.completedAssignments} completed
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">All students meet target score thresholds!</p>
            )}
          </div>
        </div>

        {/* Top Performers */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 mb-4">
            <Award className="h-5 w-5 text-indigo-600" /> Top Performer Leaderboard
          </h3>

          <div className="divide-y divide-slate-100">
            {analytics.topPerformers.length > 0 ? (
              analytics.topPerformers.map((student) => (
                <div key={student.userId} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{student.fullName}</p>
                    <p className="text-xs text-slate-400">{student.email}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Avg: {student.averageScore.toFixed(1)}/10
                    </span>
                    {student.readinessScore && (
                      <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">
                        Readiness: {student.readinessScore}%
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No students with score ≥ 8.0 yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
