import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { QuestionAnswerAuthority, ReconciliationReportDto } from '@ai-interview/contracts';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { useAuthStore } from '../../stores/auth.store';
import {
  Plus,
  Send,
  CheckCircle2,
  Archive,
  Layers,
  FileText,
  Activity,
  ShieldCheck,
} from 'lucide-react';

export function AdminQuestionBankPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reconciliationModalOpen, setReconciliationModalOpen] = useState(false);

  // Form State for Creation
  const [formData, setFormData] = useState({
    title: '',
    questionBody: '',
    questionType: 'conceptual',
    difficulty: 3,
    language: 'vi',
    authority: QuestionAnswerAuthority.REFERENCE,
    answerBody: '',
    explanationBody: '',
  });

  // Fetch Questions
  const { data: questionsData, isLoading } = useQuery({
    queryKey: ['admin-question-bank-questions', statusFilter],
    queryFn: async () => {
      const url = statusFilter
        ? `/admin/question-bank/questions?status=${statusFilter}`
        : `/admin/question-bank/questions`;
      const res = await apiClient<any>(url);
      return res.data ? res : { data: res };
    },
  });

  // Fetch Reconciliation Report
  const {
    data: reconReport,
    refetch: refetchRecon,
    isFetching: isReconFetching,
  } = useQuery<ReconciliationReportDto>({
    queryKey: ['admin-question-bank-reconciliation'],
    queryFn: async () => {
      const res = await apiClient<any>('/admin/question-bank/reconciliation');
      return res.data || res;
    },
    enabled: false,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      return apiClient('/admin/question-bank/questions', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title,
          questionBody: formData.questionBody,
          questionType: formData.questionType,
          difficulty: Number(formData.difficulty),
          language: formData.language,
          initialAnswer: {
            authority: formData.authority,
            answerBody: formData.answerBody,
            explanationBody: formData.explanationBody || undefined,
            sourceType: 'curated',
          },
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-question-bank-questions'] });
      setCreateModalOpen(false);
      setFormData({
        title: '',
        questionBody: '',
        questionType: 'conceptual',
        difficulty: 3,
        language: 'vi',
        authority: QuestionAnswerAuthority.REFERENCE,
        answerBody: '',
        explanationBody: '',
      });
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/admin/question-bank/questions/${id}/submit-review`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-question-bank-questions'] });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      return apiClient(`/admin/question-bank/questions/${selectedQuestion.id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action: reviewAction,
          reviewNotes,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-question-bank-questions'] });
      setReviewModalOpen(false);
      setSelectedQuestion(null);
      setReviewNotes('');
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/admin/question-bank/questions/${id}/publish`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-question-bank-questions'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/admin/question-bank/questions/${id}/archive`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-question-bank-questions'] });
    },
  });

  const questions = questionsData?.data || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      case 'IN_REVIEW':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
      case 'APPROVED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
      case 'PUBLISHED':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
      case 'ARCHIVED':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl flex items-center gap-2">
            <Layers className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            Quản trị Ngân hàng câu hỏi
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Câu hỏi mới được xuất bản ngay; bạn có thể lưu trữ nội dung khi không còn phù hợp.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchRecon();
              setReconciliationModalOpen(true);
            }}
            className="flex items-center gap-1.5"
          >
            <Activity className="h-4 w-4" />
            Kiểm tra đối soát
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Tạo câu hỏi mới
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {[
          { label: 'Tất cả', value: '' },
          { label: 'Bản nháp (Draft)', value: 'DRAFT' },
          { label: 'Đang duyệt (In Review)', value: 'IN_REVIEW' },
          { label: 'Đã duyệt (Approved)', value: 'APPROVED' },
          { label: 'Đã xuất bản (Published)', value: 'PUBLISHED' },
          { label: 'Lưu trữ (Archived)', value: 'ARCHIVED' },
        ].map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === tab.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Questions Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Tiêu đề câu hỏi</th>
                <th className="px-4 py-3.5">Dạng / Độ khó</th>
                <th className="px-4 py-3.5">Trạng thái</th>
                <th className="px-4 py-3.5">Tác giả</th>
                <th className="px-4 py-3.5">Cập nhật</th>
                <th className="px-6 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Không có câu hỏi nào trong trạng thái này.
                  </td>
                </tr>
              ) : (
                questions.map((q: any) => (
                  <tr key={q.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                        {q.title}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">slug: {q.slug}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {q.questionType}
                      </div>
                      <div className="text-xs text-slate-500">
                        L{q.difficulty} / {q.language}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBadge(q.status)}`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-400">
                      {q.createdBy?.email || 'N/A'}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      {new Date(q.updatedAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {q.status === 'DRAFT' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => submitReviewMutation.mutate(q.id)}
                            className="text-xs"
                          >
                            <Send className="mr-1 h-3 w-3" /> Gửi duyệt
                          </Button>
                        )}

                        {q.status === 'IN_REVIEW' && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={q.createdById === user?.id}
                            onClick={() => {
                              setSelectedQuestion(q);
                              setReviewModalOpen(true);
                            }}
                            className="text-xs text-indigo-600"
                          >
                            <FileText className="mr-1 h-3 w-3" /> Duyệt bài
                          </Button>
                        )}

                        {q.status === 'APPROVED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => publishMutation.mutate(q.id)}
                            className="text-xs"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Xuất bản
                          </Button>
                        )}

                        {q.status === 'PUBLISHED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => archiveMutation.mutate(q.id)}
                            className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                          >
                            <Archive className="mr-1 h-3 w-3" /> Lưu trữ
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Draft Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Tạo và xuất bản câu hỏi"
        maxWidth="lg"
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
              Tiêu đề câu hỏi
            </label>
            <Input
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="VD: Phân biệt Process và Thread trong hệ điều hành"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Dạng câu hỏi
              </label>
              <select
                value={formData.questionType}
                onChange={e => setFormData({ ...formData, questionType: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="conceptual">Lý thuyết / Khái niệm</option>
                <option value="coding">Lập trình</option>
                <option value="system_design">Thiết kế hệ thống</option>
                <option value="behavioral">Hành vi (STAR)</option>
                <option value="scenario">Tình huống</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Độ khó (1 - 5)
              </label>
              <select
                value={formData.difficulty}
                onChange={e => setFormData({ ...formData, difficulty: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value={1}>Level 1 - Fresher</option>
                <option value={2}>Level 2 - Junior</option>
                <option value={3}>Level 3 - Mid-Level</option>
                <option value={4}>Level 4 - Senior</option>
                <option value={5}>Level 5 - Expert / Staff</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Loại đáp án
              </label>
              <select
                value={formData.authority}
                onChange={e =>
                  setFormData({ ...formData, authority: e.target.value as QuestionAnswerAuthority })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value={QuestionAnswerAuthority.REFERENCE}>REFERENCE (Tham khảo)</option>
                <option value={QuestionAnswerAuthority.CANONICAL}>
                  CANONICAL (Chuẩn tuyệt đối)
                </option>
                <option value={QuestionAnswerAuthority.FRAMEWORK}>
                  FRAMEWORK (Khung phân tích)
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
              Đề bài chi tiết (Question Body)
            </label>
            <Textarea
              value={formData.questionBody}
              onChange={e => setFormData({ ...formData, questionBody: e.target.value })}
              rows={3}
              placeholder="Nội dung đề bài chi tiết..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
              Đáp án mẫu ban đầu (Answer Body)
            </label>
            <Textarea
              value={formData.answerBody}
              onChange={e => setFormData({ ...formData, answerBody: e.target.value })}
              rows={4}
              placeholder="Lời giải mẫu hoặc các ý chính cần trả lời..."
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setCreateModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" isLoading={createMutation.isPending}>
              Lưu bản nháp
            </Button>
          </div>
        </form>
      </Modal>

      {/* Review Modal */}
      <Modal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title="Duyệt câu hỏi phỏng vấn"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <strong>Tiêu đề:</strong> {selectedQuestion?.title}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
              Quyết định duyệt
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="reviewAction"
                  checked={reviewAction === 'APPROVE'}
                  onChange={() => setReviewAction('APPROVE')}
                />
                Phê duyệt (Approve)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="reviewAction"
                  checked={reviewAction === 'REJECT'}
                  onChange={() => setReviewAction('REJECT')}
                />
                Yêu cầu sửa lại (Reject)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
              Ghi chú của Reviewer
            </label>
            <Textarea
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              placeholder="Nhận xét về độ chính xác, format, rubric..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setReviewModalOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={() => reviewMutation.mutate()}
              isLoading={reviewMutation.isPending}
            >
              Xác nhận kết quả duyệt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reconciliation Modal */}
      <Modal
        isOpen={reconciliationModalOpen}
        onClose={() => setReconciliationModalOpen(false)}
        title="Đối soát tính toàn vẹn (Access Grants & Usage Ledger)"
        maxWidth="md"
      >
        <div className="space-y-4 text-sm">
          {isReconFetching ? (
            <div className="py-6 text-center text-slate-500">Đang quét cơ sở dữ liệu...</div>
          ) : reconReport ? (
            <div>
              <div
                className={`rounded-xl p-4 flex items-center gap-3 ${
                  reconReport.isHealthy
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                }`}
              >
                <ShieldCheck className="h-6 w-6 shrink-0" />
                <div>
                  <div className="font-bold">
                    {reconReport.isHealthy
                      ? 'Hệ thống đối soát toàn vẹn (100% Khớp)'
                      : 'Phát hiện bản ghi không khớp!'}
                  </div>
                  <div className="text-xs opacity-90 mt-0.5">
                    Thời điểm kiểm tra: {new Date(reconReport.checkedAt).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <div className="text-slate-500">Tổng số lượt cấp quyền (Grants):</div>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {reconReport.totalGrants}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <div className="text-slate-500">Tổng bản ghi Ledger:</div>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {reconReport.totalUsageRecords}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setReconciliationModalOpen(false)}>
              Đóng
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
