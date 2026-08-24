import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { AssignmentDto, AssignmentStatus, SessionMode } from '@ai-interview/contracts';
import {
  FileText,
  Plus,
  Clock,
  Play,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Alert } from '../../../components/ui/Alert';

interface AssignmentManagerProps {
  cohortId: string;
}

export const AssignmentManager: React.FC<AssignmentManagerProps> = ({ cohortId }) => {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [sessionMode, setSessionMode] = useState<SessionMode>(SessionMode.STANDARD);
  const [targetScore, setTargetScore] = useState<number>(7.5);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: assignments, isLoading } = useQuery<AssignmentDto[]>({
    queryKey: ['cohort-assignments', cohortId],
    queryFn: async () => {
      const res = await apiClient.get<AssignmentDto[]>(`/b2b/cohorts/${cohortId}/assignments`);
      return res.data;
    },
    enabled: !!cohortId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<AssignmentDto>('/b2b/assignments', {
        cohortId,
        title,
        description,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        config: {
          sessionMode,
          targetScore,
        },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohort-assignments', cohortId] });
      setIsCreateModalOpen(false);
      setTitle('');
      setDescription('');
      setDeadline('');
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to create assignment');
    },
  });

  const publishMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AssignmentStatus }) => {
      await apiClient.put(`/b2b/assignments/${id}/publish`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohort-assignments', cohortId] });
    },
  });

  const getStatusBadge = (status: AssignmentStatus) => {
    switch (status) {
      case AssignmentStatus.PUBLISHED:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case AssignmentStatus.DRAFT:
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case AssignmentStatus.CLOSED:
        return 'bg-rose-100 text-rose-800 border-rose-200';
    }
  };

  return (
    <div className="space-y-6" data-testid="assignment-manager">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" /> Cohort Interview Assignments
          </h3>
          <p className="text-xs text-slate-500">Dispatch technical mock exams and rubric requirements to students</p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-1.5"
          data-testid="create-assignment-btn"
        >
          <Plus className="h-4 w-4" /> Create Assignment
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : assignments && assignments.length > 0 ? (
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              data-testid="assignment-card"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                      assignment.status,
                    )}`}
                  >
                    {assignment.status}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    Mode: {assignment.config?.sessionMode || 'STANDARD'}
                  </span>
                </div>

                <h4 className="text-base font-bold text-slate-900">{assignment.title}</h4>
                {assignment.description && (
                  <p className="text-xs text-slate-600 mt-1 max-w-xl">{assignment.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                  {assignment.deadline && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Due: {new Date(assignment.deadline).toLocaleDateString()}
                    </span>
                  )}
                  <span>Target Score: ≥ {assignment.config?.targetScore || 7.0}/10</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {assignment.status === AssignmentStatus.DRAFT ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      publishMutation.mutate({ id: assignment.id, status: AssignmentStatus.PUBLISHED })
                    }
                    className="gap-1.5 text-xs"
                    data-testid="publish-assignment-btn"
                  >
                    <Play className="h-3.5 w-3.5" /> Publish to Cohort
                  </Button>
                ) : assignment.status === AssignmentStatus.PUBLISHED ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      publishMutation.mutate({ id: assignment.id, status: AssignmentStatus.CLOSED })
                    }
                    className="gap-1.5 text-xs text-rose-700 hover:bg-rose-50"
                  >
                    <Lock className="h-3.5 w-3.5" /> Close Assignment
                  </Button>
                ) : (
                  <span className="text-xs font-semibold text-slate-400">Closed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-sm">
          No interview assignments created yet. Click "Create Assignment" to assign mock exams.
        </div>
      )}

      {/* Create Assignment Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Create Cohort Assignment</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {errorMessage && (
              <Alert variant="error">
                <AlertCircle className="h-4 w-4" /> {errorMessage}
              </Alert>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assignment Title <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Distributed System Design Midterm Exam"
                  required
                  data-testid="assignment-title-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Instructions & Description
                </label>
                <Textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Specific requirements, topics, and rubric guidelines..."
                  data-testid="assignment-desc-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Session Mode
                  </label>
                  <select
                    value={sessionMode}
                    onChange={(e) => setSessionMode(e.target.value as SessionMode)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold"
                  >
                    <option value={SessionMode.STANDARD}>Standard Technical</option>
                    <option value={SessionMode.CODING}>Live Coding</option>
                    <option value={SessionMode.SYSTEM_DESIGN}>System Design Whiteboard</option>
                    <option value={SessionMode.BEHAVIORAL}>Behavioral STAR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Target Score
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={targetScore}
                    onChange={(e) => setTargetScore(parseFloat(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Submission Deadline
                </label>
                <Input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button type="button" variant="ghost" size="md" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={createMutation.isPending}
                  data-testid="submit-assignment-btn"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Draft'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
