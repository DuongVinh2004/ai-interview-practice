import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useI18nStore } from '../../stores/i18n.store';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import {
  TestTube,
  Play,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Zap,
  Layers,
  Globe,
  Award,
  Sparkles,
} from 'lucide-react';
import { EvalHarnessReport } from '@ai-interview/contracts';

export function AdminAiEvalPage() {
  const { t } = useI18nStore();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch latest evaluation report
  const { data: report, isLoading } = useQuery<EvalHarnessReport>({
    queryKey: ['admin-ai-eval'],
    queryFn: () => apiClient('/admin/ai/eval/latest'),
  });

  // Run on-demand regression evaluation suite
  const runMutation = useMutation({
    mutationFn: () => apiClient('/admin/ai/eval/run', { method: 'POST' }),
    onSuccess: (data: EvalHarnessReport) => {
      queryClient.setQueryData(['admin-ai-eval'], data);
      setSuccessMessage(
        `Evaluation harness completed successfully in ${data.qualityGate.p95LatencyMs}ms. Quality Gate: ${
          data.qualityGate.passed ? 'PASSED' : 'FAILED'
        }`,
      );
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to execute evaluation harness');
      setSuccessMessage(null);
    },
  });

  const handleRunEvaluation = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    runMutation.mutate();
  };

  const gate = report?.qualityGate;
  const isGatePassed = gate?.passed ?? false;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <TestTube className="h-6 w-6 text-purple-600" />
            <span>{t.adminEval.title}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t.adminEval.subtitle}</p>
        </div>

        <Button
          onClick={handleRunEvaluation}
          disabled={runMutation.isPending}
          className="gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
        >
          {runMutation.isPending ? <Spinner size="sm" /> : <Play className="h-4 w-4" />}
          <span>{runMutation.isPending ? t.adminEval.running : t.adminEval.runHarnessBtn}</span>
        </Button>
      </div>

      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading evaluation regression metrics...</p>
        </div>
      ) : !report ? (
        <Card className="text-center py-16">
          <CardContent className="space-y-3">
            <TestTube className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800">No Evaluation Runs Found</h3>
            <Button onClick={handleRunEvaluation} disabled={runMutation.isPending}>
              Run Initial Golden Benchmark
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Quality Gate Status Banner */}
          <Card
            className={`border-2 shadow-sm ${
              isGatePassed
                ? 'border-emerald-200 bg-gradient-to-r from-emerald-50/70 to-white'
                : 'border-rose-200 bg-gradient-to-r from-rose-50/70 to-white'
            }`}
          >
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`p-3 rounded-2xl ${
                      isGatePassed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {isGatePassed ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {t.adminEval.qualityGateStatus}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      {isGatePassed ? t.adminEval.gatePassed : t.adminEval.gateFailed}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Dataset: <span className="font-semibold text-slate-700">{report.datasetId}</span> (v{report.datasetVersion}) • Run: <span className="font-mono">{report.runId}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 self-end md:self-center text-xs">
                  <div className="text-right">
                    <span className="text-slate-400 block">{t.adminEval.lastRun}</span>
                    <span className="font-semibold text-slate-700">
                      {new Date(report.timestamp).toLocaleTimeString()} {new Date(report.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top 4 Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Score Interval Adherence */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{t.adminEval.scoreAdherence}</span>
                  <Award className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {gate?.scoreIntervalAdherence}%
                </div>
                <div className="text-[11px] text-slate-400">Target Threshold: ≥ 90.0%</div>
              </CardContent>
            </Card>

            {/* Metric 2: Evidence Precision */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{t.adminEval.evidencePrecision}</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {gate?.evidencePrecision}%
                </div>
                <div className="text-[11px] text-slate-400">Target Threshold: ≥ 90.0%</div>
              </CardContent>
            </Card>

            {/* Metric 3: Safety & Prompt Injection Resistance */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{t.adminEval.safetyPassRate}</span>
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {gate?.safetyPassRate}%
                </div>
                <div className="text-[11px] text-slate-400">Target Threshold: 100% (Hard Gate)</div>
              </CardContent>
            </Card>

            {/* Metric 4: p95 Latency */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{t.adminEval.p95Latency}</span>
                  <Zap className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {gate?.p95LatencyMs} ms
                </div>
                <div className="text-[11px] text-slate-400">p50: {gate?.p50LatencyMs}ms (Threshold: ≤ 3500ms)</div>
              </CardContent>
            </Card>
          </div>

          {/* Slice Analytics Section */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                <Layers className="h-4 w-4 text-purple-600" />
                <span>{t.adminEval.sliceAnalyticsTitle}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Locale Slices */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{t.adminEval.localeSlices}</span>
                  </h4>
                  <div className="space-y-2">
                    {report.sliceMetrics
                      .filter(s => s.sliceCategory === 'LOCALE')
                      .map(s => (
                        <div
                          key={s.sliceKey}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-slate-800">
                            {s.sliceKey === 'locale:vi-VN' ? '🇻🇳 Vietnamese (vi-VN)' : '🇬🇧 English (en-US)'}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500">{s.passedCases}/{s.totalCases} passed</span>
                            <Badge variant={s.adherencePercentage >= 90 ? 'success' : 'warning'}>
                              {s.adherencePercentage}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Competency Area Slices */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    <span>{t.adminEval.competencySlices}</span>
                  </h4>
                  <div className="space-y-2">
                    {report.sliceMetrics
                      .filter(s => s.sliceCategory === 'COMPETENCY')
                      .map(s => (
                        <div
                          key={s.sliceKey}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-slate-800">
                            {s.sliceKey.replace('competency:', '')}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500">{s.passedCases}/{s.totalCases} passed</span>
                            <Badge variant={s.adherencePercentage >= 90 ? 'success' : 'warning'}>
                              {s.adherencePercentage}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Test Case Breakdown Table */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                <TestTube className="h-4 w-4 text-purple-600" />
                <span>{t.adminEval.caseDetailsTitle}</span>
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">{t.adminEval.caseId}</th>
                    <th className="py-3 px-4">{t.adminEval.domainRole}</th>
                    <th className="py-3 px-4">{t.adminEval.actualVsExpected}</th>
                    <th className="py-3 px-4">{t.adminEval.latency}</th>
                    <th className="py-3 px-4 text-right">{t.adminEval.status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {report.caseResults.map(tc => (
                    <tr key={tc.caseId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">
                        {tc.caseId}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{tc.role}</span> ({tc.seniority}) •{' '}
                        <span className="text-slate-500">{tc.competencyArea}</span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-slate-900">{tc.score}</span> / 10{' '}
                        <span className="text-slate-400 font-normal">[{tc.expectedMin} - {tc.expectedMax}]</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {tc.latencyMs}ms
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge variant={tc.status === 'PASSED' ? 'success' : 'danger'}>
                          {tc.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
export default AdminAiEvalPage;
