import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { CohortDto } from '@ai-interview/contracts';
import { GraduationCap, Plus, Users, ArrowRight, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { useNavigate, Link } from 'react-router-dom';

export const CohortListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');

  const { data: cohorts, isLoading } = useQuery<CohortDto[]>({
    queryKey: ['tenant-cohorts'],
    queryFn: async () => {
      const res = await apiClient.get<CohortDto[]>('/b2b/cohorts');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<CohortDto>('/b2b/cohorts', {
        name,
        description,
      });
      return res.data;
    },
    onSuccess: newCohort => {
      queryClient.invalidateQueries({ queryKey: ['tenant-cohorts'] });
      setIsModalOpen(false);
      setName('');
      setDescription('');
      navigate(`/b2b/cohorts/${newCohort.id}`);
    },
  });

  const filteredCohorts = cohorts?.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8" data-testid="cohort-list-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/b2b/dashboard"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Training Cohorts & Student Batches
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Organize learners into batches, monitor roster performance, and distribute mock
            interviews.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="gap-1.5"
          data-testid="new-cohort-btn"
        >
          <Plus className="h-4 w-4" /> New Cohort
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Filter cohorts by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
          data-testid="cohort-search-input"
        />
      </div>

      {/* Cohorts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-slate-100 rounded-3xl animate-pulse" />
          ))
        ) : filteredCohorts && filteredCohorts.length > 0 ? (
          filteredCohorts.map(cohort => (
            <div
              key={cohort.id}
              onClick={() => navigate(`/b2b/cohorts/${cohort.id}`)}
              className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              data-testid="cohort-card-item"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-lg text-slate-900">{cohort.name}</h3>
                  <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <GraduationCap className="h-5 w-5" />
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2 line-clamp-3">
                  {cohort.description || 'No description provided.'}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-slate-400" /> {cohort.memberCount || 0} Students
                </span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  Manage Roster <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-slate-400">
            <GraduationCap className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            No cohorts found. Create a cohort to start enrolling students.
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Create New Cohort</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cohort Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Spring 2026 CS Batch A"
                  required
                  data-testid="create-cohort-name-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <Textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Goals, target roles, or curriculum details..."
                  data-testid="create-cohort-desc-input"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={!name || createMutation.isPending}
                  data-testid="submit-create-cohort-btn"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Cohort'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
