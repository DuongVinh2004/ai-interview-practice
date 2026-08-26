import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useI18nStore } from '../../stores/i18n.store';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';
import { MessageSquarePlus, UserCheck, Send } from 'lucide-react';

interface MentorFeedbackItem {
  id: string;
  turnNumber?: number | null;
  mentorName: string;
  comment: string;
  createdAt: string;
}

interface MentorFeedbackListProps {
  token: string;
  feedbackList: MentorFeedbackItem[];
  onFeedbackAdded?: () => void;
}

export function MentorFeedbackList({
  token,
  feedbackList,
  onFeedbackAdded,
}: MentorFeedbackListProps) {
  const { t } = useI18nStore();
  const [mentorName, setMentorName] = useState('');
  const [comment, setComment] = useState('');
  const [turnNumber, setTurnNumber] = useState<number | ''>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addFeedbackMutation = useMutation({
    mutationFn: () =>
      apiClient(`/public/share/${token}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          mentorName: mentorName.trim(),
          comment: comment.trim(),
          turnNumber: turnNumber === '' ? undefined : Number(turnNumber),
        }),
      }),
    onSuccess: () => {
      setSuccessMessage(t.share.feedbackSuccess);
      setComment('');
      setTurnNumber('');
      if (onFeedbackAdded) onFeedbackAdded();
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to submit mentor feedback');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!mentorName.trim()) {
      setErrorMessage('Please enter your mentor name or title.');
      return;
    }
    if (!comment.trim() || comment.trim().length < 5) {
      setErrorMessage('Comment must be at least 5 characters long.');
      return;
    }

    addFeedbackMutation.mutate();
  };

  return (
    <div className="space-y-6" data-testid="mentor-feedback-list">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-emerald-600" />
          <span>
            {t.share.mentorReviewHeader} ({feedbackList.length})
          </span>
        </h3>
      </div>

      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      {/* Existing Feedbacks */}
      {feedbackList.length === 0 ? (
        <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
          No mentor notes submitted yet. Use the review form below to leave professional feedback!
        </div>
      ) : (
        <div className="space-y-3">
          {feedbackList.map(item => (
            <div
              key={item.id}
              className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2 hover:border-emerald-200 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-900">{item.mentorName}</span>
                  {item.turnNumber && (
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                      Turn #{item.turnNumber}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {item.comment}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add Feedback Form */}
      <form
        onSubmit={handleSubmit}
        className="p-5 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 shadow-sm space-y-4"
      >
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <MessageSquarePlus className="h-4 w-4 text-emerald-600" />
          <span>{t.share.leaveFeedback}</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              {t.share.mentorNameLabel} *
            </label>
            <Input
              value={mentorName}
              onChange={e => setMentorName(e.target.value)}
              placeholder="e.g. Alex Nguyen (Staff Backend Engineer)"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              {t.share.turnSpecific}
            </label>
            <select
              value={turnNumber}
              onChange={e => setTurnNumber(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">General Session Feedback</option>
              <option value="1">Question 1</option>
              <option value="2">Question 2</option>
              <option value="3">Question 3</option>
              <option value="4">Question 4</option>
              <option value="5">Question 5</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            {t.share.commentLabel} *
          </label>
          <Textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            placeholder="Share technical insights, system design suggestions, or code trade-offs..."
            required
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={addFeedbackMutation.isPending}
            className="gap-2"
            size="sm"
          >
            {addFeedbackMutation.isPending ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
            <span>{t.share.submitFeedback}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
