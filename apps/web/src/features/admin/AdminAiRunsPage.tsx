import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useI18nStore } from '../../stores/i18n.store';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import {
  Activity,
  Cpu,
  DollarSign,
  Zap,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export function AdminAiRunsPage() {
  const { t } = useI18nStore();
  const [page, setPage] = useState(1);
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // 1. Fetch Aggregated AI Metrics
  const { data: metrics, isLoading: isMetricsLoading } = useQuery<any>({
    queryKey: ['admin-ai-metrics'],
    queryFn: () => apiClient('/admin/ai/metrics'),
    refetchInterval: 10000,
  });

  // 2. Fetch AI Runs List
  const { data: runsData, isLoading: isRunsLoading } = useQuery<{ items: any[]; meta: any }>({
    queryKey: ['admin-ai-runs', page, providerFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      if (providerFilter) params.set('provider', providerFilter);
      if (statusFilter) params.set('status', statusFilter);
      return apiClient(`/admin/ai/runs?${params.toString()}`);
    },
    refetchInterval: 10000,
  });

  const runs = runsData?.items || [];
  const meta = runsData?.meta;

  const circuitEntries = Object.entries(metrics?.circuitBreakerStates || {});

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-xl">
          <Activity className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t.admin.aiTelemetryTitle}</h1>
          <p className="text-sm text-slate-500">{t.admin.aiTelemetrySubtitle}</p>
        </div>
      </div>

      {/* Top Metrics Cards */}
      {isMetricsLoading ? (
        <div className="py-8 text-center">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Daily Cost vs Budget */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t.admin.dailyBudget}
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 font-mono">
                ${metrics?.todayCostUsd?.toFixed(4) || '0.0000'}
              </span>
              <span className="text-xs text-slate-400">
                / ${metrics?.dailyBudgetUsd?.toFixed(2) || '50.00'}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, metrics?.budgetUsedPercentage || 0)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block font-mono">
              {metrics?.budgetUsedPercentage || 0}% used today
            </span>
          </Card>

          {/* Tokens Today */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t.admin.todayTokens}
              </span>
              <div className="p-2 bg-purple-50 text-purple-700 rounded-lg">
                <Cpu className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {metrics?.todayTokens?.toLocaleString() || 0}
            </div>
            <p className="text-[10px] text-slate-400 mt-3">Across question & evaluation prompts</p>
          </Card>

          {/* Average Latency */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t.admin.avgLatency}
              </span>
              <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                <Zap className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900 font-mono">
                {metrics?.avgLatencyMs || 0}
              </span>
              <span className="text-xs text-slate-400">ms</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-3">Network & model execution roundtrip</p>
          </Card>

          {/* Success Rate */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t.admin.successRate}
              </span>
              <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-700 font-mono">
              {metrics?.successRate || 100}%
            </div>
            <p className="text-[10px] text-slate-400 mt-3">
              {metrics?.successRuns || 0} success / {metrics?.totalRuns || 0} total runs
            </p>
          </Card>
        </div>
      )}

      {/* Circuit Breaker States Status Bar */}
      <Card className="border-slate-200">
        <CardHeader className="bg-slate-50/70 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-sm">{t.admin.circuitBreaker}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {circuitEntries.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>
                All provider circuits are healthy and in <strong>CLOSED</strong> (operational)
                state.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {circuitEntries.map(([key, info]: [string, any]) => {
                const isOpen = info.state === 'OPEN';
                const isHalfOpen = info.state === 'HALF_OPEN';

                return (
                  <div
                    key={key}
                    className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                      isOpen
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : isHalfOpen
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <div>
                      <span className="font-bold font-mono">{key}</span>
                      <span className="block text-[10px] text-slate-500">
                        Failures in window: {info.failureCount}
                      </span>
                    </div>
                    <Badge variant={isOpen ? 'danger' : isHalfOpen ? 'warning' : 'success'}>
                      {info.state}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Runs Audit Log Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>{t.admin.totalRuns}</CardTitle>

            {/* Filter controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={providerFilter}
                onChange={e => {
                  setProviderFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="">All Providers</option>
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="mock">Mock</option>
              </select>

              <select
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isRunsLoading ? (
            <div className="py-16 text-center">
              <Spinner />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-5 py-3">{t.admin.provider}</th>
                    <th className="px-5 py-3">{t.admin.model}</th>
                    <th className="px-5 py-3">Prompt Slug</th>
                    <th className="px-5 py-3">{t.admin.tokens}</th>
                    <th className="px-5 py-3">{t.admin.latency}</th>
                    <th className="px-5 py-3">{t.admin.cost}</th>
                    <th className="px-5 py-3">{t.admin.status}</th>
                    <th className="px-5 py-3 text-right">{t.admin.time}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {runs.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-900 uppercase">{r.provider}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{r.model}</td>
                      <td className="px-5 py-3.5 text-slate-700 font-sans">
                        <span>{r.promptSlug}</span>
                        <span className="text-[10px] text-slate-400 ml-1">v{r.promptVersion}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-800">
                        {r.totalTokens?.toLocaleString() || 0}
                      </td>
                      <td className="px-5 py-3.5 text-slate-800">{r.latencyMs}ms</td>
                      <td className="px-5 py-3.5 text-slate-800">
                        ${r.costEstimate?.toFixed(5) || '0.00000'}
                      </td>
                      <td className="px-5 py-3.5 font-sans">
                        <Badge variant={r.status === 'SUCCESS' ? 'success' : 'danger'}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-500 font-sans">
                        {new Date(r.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination controls */}
              {meta && meta.totalPages > 1 && (
                <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Page {meta.page} of {meta.totalPages} ({meta.total} total runs)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={!meta.hasPrevPage}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>Previous</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={!meta.hasNextPage}
                      className="gap-1"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
