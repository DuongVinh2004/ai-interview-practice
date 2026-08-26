import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { TenantDto, CohortDto, TenantApiKeyDto } from '@ai-interview/contracts';
import {
  Building,
  Users,
  GraduationCap,
  Key,
  Plus,
  ArrowRight,
  CheckCircle,
  Copy,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useNavigate, Link } from 'react-router-dom';

export const TenantDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyName, setApiKeyName] = useState('');
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  // 1. Fetch current tenant
  const { data: tenant } = useQuery<TenantDto>({
    queryKey: ['my-tenant'],
    queryFn: async () => {
      const res = await apiClient.get<TenantDto>('/b2b/tenant/me');
      return res.data;
    },
  });

  // 2. Fetch cohorts
  const { data: cohorts, isLoading: isLoadingCohorts } = useQuery<CohortDto[]>({
    queryKey: ['tenant-cohorts'],
    queryFn: async () => {
      const res = await apiClient.get<CohortDto[]>('/b2b/cohorts');
      return res.data;
    },
  });

  // 3. Fetch API keys
  const { data: apiKeys } = useQuery<TenantApiKeyDto[]>({
    queryKey: ['tenant-api-keys'],
    queryFn: async () => {
      const res = await apiClient.get<TenantApiKeyDto[]>('/b2b/api-keys');
      return res.data;
    },
  });

  // Issue API key mutation
  const apiKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ apiKey: string }>('/b2b/api-keys', {
        name: apiKeyName,
      });
      return res.data;
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['tenant-api-keys'] });
      setIssuedKey(data.apiKey);
      setApiKeyName('');
    },
  });

  const totalMembers = cohorts?.reduce((sum, c) => sum + (c.memberCount || 0), 0) || 0;
  const totalAssignments = cohorts?.reduce((sum, c) => sum + (c.assignmentCount || 0), 0) || 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8" data-testid="tenant-dashboard-page">
      {/* Organization Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-8 sm:p-10 shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-3xl font-extrabold shadow-inner">
              <Building className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {tenant?.name || 'Enterprise Multi-Tenant Dashboard'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Active Tenant
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1">
                Domain: {tenant?.domain || `${tenant?.slug || 'organization'}.ai-interview.com`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsApiKeyModalOpen(true)}
              className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
              data-testid="open-api-keys-btn"
            >
              <Key className="h-4 w-4 text-emerald-400" /> API Keys & LMS
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/b2b/cohorts')}
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
              data-testid="manage-cohorts-btn"
            >
              <Plus className="h-4 w-4" /> New Cohort
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Active Cohorts</span>
          <span className="text-3xl font-extrabold text-slate-900 mt-1 block">
            {cohorts?.length || 0}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Training batches</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Total Students</span>
          <span className="text-3xl font-extrabold text-emerald-700 mt-1 block">
            {totalMembers}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Enrolled candidates</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Total Assignments</span>
          <span className="text-3xl font-extrabold text-slate-900 mt-1 block">
            {totalAssignments}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Dispatched mock tests</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">LMS API Keys</span>
          <span className="text-3xl font-extrabold text-indigo-600 mt-1 block">
            {apiKeys?.length || 0}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Active webhooks</span>
        </div>
      </div>

      {/* Cohorts Grid */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-emerald-600" /> Active Cohorts & Batches
            </h2>
            <p className="text-xs text-slate-500">
              Monitor student progress, roster, and assignments per batch
            </p>
          </div>

          <Link
            to="/b2b/cohorts"
            className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
          >
            View All Cohorts <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="cohort-list"
        >
          {isLoadingCohorts ? (
            [1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
            ))
          ) : cohorts && cohorts.length > 0 ? (
            cohorts.map(cohort => (
              <div
                key={cohort.id}
                onClick={() => navigate(`/b2b/cohorts/${cohort.id}`)}
                className="p-5 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                data-testid="cohort-card"
              >
                <div>
                  <h3 className="font-bold text-base text-slate-900">{cohort.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {cohort.description || 'No description provided.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1 font-semibold">
                    <Users className="h-3.5 w-3.5 text-slate-400" /> {cohort.memberCount || 0}{' '}
                    Students
                  </span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    Open Cohort <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-slate-400 text-sm">
              No cohorts created yet. Click "New Cohort" to set up your first student batch.
            </div>
          )}
        </div>
      </div>

      {/* API Key Modal */}
      {isApiKeyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
          data-testid="api-key-modal"
        >
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Key className="h-5 w-5 text-emerald-600" /> Organization API Keys
              </h3>
              <button
                onClick={() => {
                  setIsApiKeyModalOpen(false);
                  setIssuedKey(null);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {issuedKey ? (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                <span className="text-xs font-bold text-emerald-900 block flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-emerald-600" /> API Key Created
                </span>
                <p className="text-xs text-slate-600">
                  Make sure to copy your API key now. You won’t be able to see it again!
                </p>
                <div className="p-2.5 bg-white rounded-lg border border-emerald-300 font-mono text-xs text-slate-900 select-all break-all flex justify-between items-center">
                  <span>{issuedKey}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(issuedKey)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500"
                    title="Copy"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Key Name / Integration
                  </label>
                  <Input
                    type="text"
                    value={apiKeyName}
                    onChange={e => setApiKeyName(e.target.value)}
                    placeholder="e.g. Canvas LMS Integration Key"
                    data-testid="api-key-name-input"
                  />
                </div>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => apiKeyMutation.mutate()}
                  disabled={!apiKeyName || apiKeyMutation.isPending}
                  className="w-full"
                  data-testid="generate-api-key-btn"
                >
                  {apiKeyMutation.isPending ? 'Generating...' : 'Generate New API Key'}
                </Button>
              </div>
            )}

            <div className="space-y-2 border-t border-slate-100 pt-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Active Keys
              </h4>
              {apiKeys && apiKeys.length > 0 ? (
                <div className="divide-y divide-slate-100 text-xs">
                  {apiKeys.map(k => (
                    <div key={k.id} className="py-2 flex justify-between items-center">
                      <span className="font-semibold text-slate-800">{k.name}</span>
                      <span className="text-slate-400 font-mono">{k.id.slice(0, 8)}...</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No active keys issued yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
