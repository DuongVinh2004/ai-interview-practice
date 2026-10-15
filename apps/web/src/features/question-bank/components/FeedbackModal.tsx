import { useState, useEffect, useRef } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { QuestionFeedbackReason } from '@ai-interview/contracts';
import { Flag, CheckCircle2 } from 'lucide-react';
import { useI18nStore } from '../../../stores/i18n.store';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: QuestionFeedbackReason, details: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function FeedbackModal({ isOpen, onClose, onSubmit, isSubmitting }: FeedbackModalProps) {
  const { language } = useI18nStore();
  const isVi = language === 'vi';

  const [reason, setReason] = useState<QuestionFeedbackReason>(
    QuestionFeedbackReason.INCORRECT_ANSWER,
  );
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(reason, details);
    setSubmitted(true);
    timeoutRef.current = setTimeout(() => {
      setSubmitted(false);
      setDetails('');
      onClose();
    }, 1500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isVi ? 'Báo lỗi hoặc góp ý nội dung câu hỏi' : 'Report Issue or Suggest Feedback'}
      maxWidth="md"
    >
      {submitted ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h4 className="text-base font-semibold text-slate-900 dark:text-white">
            {isVi ? 'Cảm ơn bạn đã đóng góp!' : 'Thank you for your feedback!'}
          </h4>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isVi
              ? 'Đội ngũ biên tập viên sẽ xem xét và cập nhật nội dung trong thời gian sớm nhất.'
              : 'Our editorial team will review and update this question promptly.'}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isVi ? 'Lý do báo cáo' : 'Report Reason'}
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value as QuestionFeedbackReason)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value={QuestionFeedbackReason.INCORRECT_ANSWER}>
                {isVi ? 'Đáp án hoặc mã nguồn chưa chính xác' : 'Inaccurate solution or code'}
              </option>
              <option value={QuestionFeedbackReason.TYPO_ERROR}>
                {isVi ? 'Lỗi chính tả / cú pháp đề bài' : 'Typo or description syntax error'}
              </option>
              <option value={QuestionFeedbackReason.POOR_EXPLANATION}>
                {isVi
                  ? 'Lời giải thích hoặc Rubric chưa rõ ràng'
                  : 'Unclear explanation or evaluation rubric'}
              </option>
              <option value={QuestionFeedbackReason.OUTDATED_CONTENT}>
                {isVi
                  ? 'Kiến thức hoặc công nghệ đã lỗi thời'
                  : 'Outdated technology or deprecated knowledge'}
              </option>
              <option value={QuestionFeedbackReason.OTHER}>
                {isVi ? 'Lý do khác' : 'Other reason'}
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isVi ? 'Chi tiết góp ý (Tùy chọn)' : 'Feedback Details (Optional)'}
            </label>
            <Textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder={
                isVi
                  ? 'Mô tả cụ thể điểm cần sửa hoặc bổ sung...'
                  : 'Describe specific issues or proposed corrections...'
              }
              rows={4}
              maxLength={2000}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
              {isVi ? 'Hủy' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
              className="flex items-center gap-1.5"
            >
              <Flag className="h-4 w-4" />
              {isVi ? 'Gửi báo cáo' : 'Submit Feedback'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
