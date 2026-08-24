import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { ImportRosterResultDto } from '@ai-interview/contracts';
import { CohortAnalyticsView } from './components/CohortAnalyticsView';
import { AssignmentManager } from './components/AssignmentManager';
import {
  Users,
  BarChart3,
  FileText,
  Upload,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { Alert } from '../../components/ui/Alert';

export const CohortDetailPage: React.FC = () => {
  const { id: cohortId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'analytics' | 'roster' | 'assignments'>('analytics');
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [importResult, setImportResult] = useState<ImportRosterResultDto | null>(null);

  const { data: cohort, isLoading } = useQuery<any>({
    queryKey: ['cohort-detail', cohortId],
    queryFn: async () => {
      const res = await apiClient.get(`/b2b/cohorts/${cohortId}`);
      return res.data;
    },
    enabled: !!cohortId,
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ImportRosterResultDto>(`/b2b/cohorts/${cohortId}/members/csv`, {
        csvContent,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cohort-detail', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohort-analytics', cohortId] });
      setImportResult(data);
      setCsvContent('');
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-pulse" data-testid="cohort-detail-loading">
        <div className="h-24 bg-slate-100 rounded-3xl" />
        <div className="h-96 bg-slate-100 rounded-3xl" />
      </div>
    );
  }

  if (!cohort) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <h2 className="text-xl font-bold text-slate-900">Cohort Not Found</h2>
        <Link to="/b2b/cohorts" className="text-emerald-700 font-semibold hover:underline mt-2 inline-block">
          Return to Cohort List
        </Link>
      </div>
    );
  }

  const sampleCsvTemplate = `email,fullName,role
alice.johnson@university.edu,"Alice Johnson",STUDENT
bob.smith@university.edu,"Bob Smith",STUDENT
instructor.lee@university.edu,"Prof. David Lee",INSTRUCTOR`;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6" data-testid="cohort-detail-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <Link to="/b2b/cohorts" className="text-xs font-semibold text-slate-500 hover:text-emerald-700 flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to All Cohorts
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{cohort.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Active Cohort
            </span>
          </div>
          {cohort.description && (
            <p className="text-xs text-slate-500 mt-1 max-w-xl">{cohort.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCsvModalOpen(true)}
            className="gap-2"
            data-testid="import-csv-btn"
          >
            <Upload className="h-4 w-4" /> Bulk Import CSV Roster
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'analytics'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          data-testid="tab-analytics"
        >
          <BarChart3 className="h-4 w-4" /> Cohort Analytics & Heatmap
        </button>

        <button
          onClick={() => setActiveTab('roster')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'roster'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          data-testid="tab-roster"
        >
          <Users className="h-4 w-4" /> Student Roster ({cohort.members?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'assignments'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          data-testid="tab-assignments"
        >
          <FileText className="h-4 w-4" /> Assignments ({cohort.assignments?.length || 0})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'analytics' && <CohortAnalyticsView cohortId={cohortId || ''} />}

      {activeTab === 'roster' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4" data-testid="roster-panel">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-bold text-base text-slate-900">Enrolled Members Roster</h3>
              <p className="text-xs text-slate-500">Learners and instructors enrolled in this training cohort</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Enrolled Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {cohort.members && cohort.members.length > 0 ? (
                  cohort.members.map((member: any) => (
                    <tr key={member.cohortMemberId} className="hover:bg-slate-50/50" data-testid="roster-row">
                      <td className="py-3 px-4 font-bold">{member.fullName}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{member.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          member.role === 'INSTRUCTOR' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(member.enrolledAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No members enrolled yet. Use "Bulk Import CSV Roster" to add students.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'assignments' && <AssignmentManager cohortId={cohortId || ''} />}

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" data-testid="csv-modal">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="h-5 w-5 text-emerald-600" /> Bulk Import Roster CSV
              </h3>
              <button onClick={() => { setIsCsvModalOpen(false); setImportResult(null); }} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {importResult && (
              <Alert variant={importResult.errors.length > 0 ? 'warning' : 'success'}>
                <div className="space-y-1 text-xs">
                  <p className="font-bold">
                    Successfully enrolled {importResult.successCount} of {importResult.totalImported} students! ({importResult.skippedCount} skipped)
                  </p>
                  {importResult.errors.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 text-rose-700">
                      {importResult.errors.slice(0, 3).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </Alert>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Paste CSV Content</span>
                <button
                  type="button"
                  onClick={() => setCsvContent(sampleCsvTemplate)}
                  className="text-emerald-700 hover:underline font-semibold"
                >
                  Load Sample Template
                </button>
              </div>

              <Textarea
                rows={7}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="email,fullName,role&#10;alice@school.edu,Alice,STUDENT&#10;bob@school.edu,Bob,STUDENT"
                className="font-mono text-xs"
                data-testid="csv-textarea"
              />
              <p className="text-[11px] text-slate-400">Headers supported: <code>email,fullName,role</code> (role can be STUDENT or INSTRUCTOR).</p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" size="md" onClick={() => { setIsCsvModalOpen(false); setImportResult(null); }}>
                Close
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => importMutation.mutate()}
                disabled={!csvContent || importMutation.isPending}
                data-testid="submit-csv-btn"
              >
                {importMutation.isPending ? 'Importing Roster...' : 'Process CSV Import'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
