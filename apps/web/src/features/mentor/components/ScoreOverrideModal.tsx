import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { X, ShieldAlert, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { Alert } from '../../../components/ui/Alert';

interface ScoreOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  evaluationId: string;
  originalScore: number;
  onSuccess?: () => void;
}

export const ScoreOverrideModal: React.FC<ScoreOverrideModalProps> = ({
  isOpen,
  onClose,
  evaluationId,
  originalScore,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [newScore, setNewScore] = useState<number>(originalScore);
  const [justification, setJustification] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const overrideMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/evaluations/${evaluationId}/override`, {
        evaluationId,
        newScore: Number(newScore),
        justification,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interview-session'] });
      queryClient.invalidateQueries({ queryKey: ['live-session'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to override score');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (justification.trim().length < 10) {
      setErrorMessage('Justification reason must be at least 10 characters long.');
      return;
    }
    setErrorMessage(null);
    overrideMutation.mutate();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-override-title"
      aria-describedby="score-override-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
      data-testid="score-override-modal"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h3 id="score-override-title" className="text-lg font-bold text-slate-900">
              Override AI Evaluation Score
            </h3>
            <p id="score-override-desc" className="text-xs text-slate-500">
              Human-in-the-loop mentor moderation with audit trail
            </p>
          </div>
        </div>

        {errorMessage && (
          <Alert variant="error" className="mb-4">
            <AlertCircle className="h-4 w-4" /> {errorMessage}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-xs text-slate-500 block font-medium">Original AI Score</span>
              <span className="text-lg font-bold text-slate-700">
                {originalScore.toFixed(1)} / 10.0
              </span>
            </div>
            <div className="text-right">
              <label className="text-xs text-slate-500 block font-medium mb-1">
                Adjusted Mentor Score
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={newScore}
                onChange={e => setNewScore(parseFloat(e.target.value) || 0)}
                className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-base font-bold text-emerald-700 text-right focus:ring-emerald-500 focus:border-emerald-500"
                required
                data-testid="override-score-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Mentor Justification & Feedback Note <span className="text-rose-500">*</span>
            </label>
            <Textarea
              rows={4}
              value={justification}
              onChange={e => setJustification(e.target.value)}
              placeholder="Explain why the automated AI score was adjusted (e.g. candidate elaborated on deadlock recovery during probing discussion)..."
              required
              data-testid="override-justification-input"
            />
            <p className="text-xs text-slate-400 mt-1">
              This explanation is appended to the permanent audit trail.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={overrideMutation.isPending}
              data-testid="confirm-override-btn"
            >
              {overrideMutation.isPending ? 'Saving...' : 'Confirm Score Override'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
