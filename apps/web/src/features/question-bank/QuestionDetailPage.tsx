import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import {
  QuestionBankQuestionDetailDto,
  QuestionBankAnswerDto,
  RevealAnswerResponseDto,
  QuestionFeedbackReason,
} from '@ai-interview/contracts';
import { PaywallModal } from './components/PaywallModal';
import { FeedbackModal } from './components/FeedbackModal';
import { QuestionCard } from './components/QuestionCard';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuthStore } from '../../stores/auth.store';
import {
  ArrowLeft,
  Bookmark,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Flag,
  Info,
  ShieldCheck,
} from 'lucide-react';

export function QuestionDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const [showPaywall, setShowPaywall] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  // Fetch Question Details
  const {
    data: question,
    isLoading,
    isError,
  } = useQuery<QuestionBankQuestionDetailDto>({
    queryKey: ['question-bank-detail', slug],
    queryFn: async () => {
      const res = await apiClient<any>(`/question-bank/questions/${slug}`);
      return res.data || res;
    },
    enabled: !!slug,
  });

  // Reveal Answer Mutation
  const revealMutation = useMutation({
    mutationFn: async (): Promise<RevealAnswerResponseDto | undefined> => {
      if (!isAuthenticated) {
        navigate('/login');
        return;
      }

      const idempotencyKey = crypto.randomUUID();
      // apiClient unwraps the global envelope; the feature response still contains { data, meta }.
      const response = await apiClient<RevealAnswerResponseDto>(
        `/question-bank/questions/${question?.id}/reveal-answer`,
        {
          method: 'POST',
          idempotencyKey,
        },
      );
      return response;
    },
    onMutate: () => {
      setRevealError(null);
    },
    onSuccess: response => {
      if (response) {
        const answer: QuestionBankAnswerDto = response.data;
        // Render the just-authorized answer immediately instead of relying on a second GET.
        queryClient.setQueryData<QuestionBankQuestionDetailDto>(
          ['question-bank-detail', slug],
          current =>
            current
              ? {
                  ...current,
                  answer,
                  isRevealed: true,
                  revealedAt: new Date().toISOString(),
                }
              : current,
        );
      }

      queryClient.invalidateQueries({ queryKey: ['question-bank-questions'] });
      queryClient.invalidateQueries({ queryKey: ['question-bank-access-status'] });
    },
    onError: (err: any) => {
      if (
        err?.code === 'QUESTION_BANK_QUOTA_EXHAUSTED' ||
        err?.status === 403 ||
        err?.message?.includes('hết lượt')
      ) {
        setShowPaywall(true);
      } else {
        setRevealError(err?.message || 'Không thể tải đáp án. Vui lòng thử lại.');
      }
    },
  });

  // Bookmark Mutation
  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) {
        navigate('/login');
        return;
      }
      if (question?.isBookmarked) {
        return apiClient(`/question-bank/questions/${question?.id}/bookmark`, { method: 'DELETE' });
      } else {
        return apiClient(`/question-bank/questions/${question?.id}/bookmark`, { method: 'POST' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-bank-detail', slug] });
      queryClient.invalidateQueries({ queryKey: ['question-bank-bookmarks'] });
    },
  });

  // Feedback Submission
  const handleFeedbackSubmit = async (reason: QuestionFeedbackReason, details: string) => {
    if (!question) return;
    await apiClient(`/question-bank/questions/${question.id}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ reason, details }),
    });
  };

  const getAuthorityBadge = (authority?: string) => {
    switch (authority) {
      case 'CANONICAL':
        return {
          label: 'Đáp án chuẩn (Canonical)',
          color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
        };
      case 'FRAMEWORK':
        return {
          label: 'Khung trả lời (Framework)',
          color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
        };
      case 'REFERENCE':
      default:
        return {
          label: 'Đáp án tham khảo (Reference)',
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
        };
    }
  };

  const getRubricItems = (rubric: unknown): string[] => {
    if (Array.isArray(rubric)) {
      return rubric.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
    }

    if (rubric && typeof rubric === 'object') {
      return Object.entries(rubric as Record<string, unknown>).flatMap(([group, value]) => {
        const label = group.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase());
        const values = Array.isArray(value) ? value : [value];
        return values
          .filter(
            (item): item is string | number => typeof item === 'string' || typeof item === 'number',
          )
          .map(item => `${label}: ${item}`);
      });
    }

    return [];
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Skeleton className="h-6 w-32 mb-6" />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex gap-2 mb-4">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-24 w-full mb-6" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !question) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-rose-500" />
        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          Không tìm thấy câu hỏi
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Câu hỏi không tồn tại hoặc đã được chuyển vào kho lưu trữ nội bộ.
        </p>
        <Link to="/question-bank" className="mt-6 inline-block">
          <Button variant="primary">Quay lại Ngân hàng câu hỏi</Button>
        </Link>
      </div>
    );
  }

  const authorityInfo = getAuthorityBadge(question.answer?.authority);
  const rubricItems = getRubricItems(question.answer?.rubric);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb & Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/question-bank"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Tất cả câu hỏi
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFeedback(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Flag className="h-3.5 w-3.5" />
            Báo lỗi
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => bookmarkMutation.mutate()}
            isLoading={bookmarkMutation.isPending}
            className="flex items-center gap-1.5"
          >
            <Bookmark
              className="h-4 w-4 text-amber-500"
              fill={question.isBookmarked ? 'currentColor' : 'none'}
            />
            {question.isBookmarked ? 'Đã lưu' : 'Lưu câu hỏi'}
          </Button>
        </div>
      </div>

      {/* Main Question Container */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        {/* Badges Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
          <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {question.questionType.toUpperCase()}
          </span>

          <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Độ khó: Level {question.difficulty}/5
          </span>

          {question.jobRole && (
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {question.jobRole.name}
            </span>
          )}

          {question.seniorityLevel && (
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {question.seniorityLevel.name}
            </span>
          )}
        </div>

        {/* Question Title & Content */}
        <h1 className="mt-5 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
          {question.title}
        </h1>

        <div className="mt-4 text-base leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
          {question.questionBody}
        </div>

        {/* Technologies */}
        {question.technologies && question.technologies.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Chủ đề:</span>
            {question.technologies.map(t => (
              <span
                key={t.id}
                className="rounded-full bg-slate-100 px-3 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Answer & Rubric Section */}
      <div className="mt-5">
        {question.answer ? (
          /* Revealed Answer */
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-950 dark:bg-emerald-950/20">
              {/* Answer Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200/60 pb-3 dark:border-emerald-900/60">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Đáp án tham khảo đã kiểm duyệt
                  </h2>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${authorityInfo.color}`}
                >
                  {authorityInfo.label}
                </span>
              </div>

              {/* Answer Body */}
              <div className="mt-4 max-w-none whitespace-pre-wrap text-[15px] leading-7 text-slate-800 dark:text-slate-200">
                {question.answer.answerBody}
              </div>

              {/* Explanation (if provided) */}
              {question.answer.explanationBody && (
                <div className="mt-4 border-l-2 border-indigo-300 pl-4 dark:border-indigo-700">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <Info className="h-4 w-4" /> Giải thích chi tiết
                  </h4>
                  <p className="mt-1.5 text-sm leading-6 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {question.answer.explanationBody}
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {rubricItems.length > 0 && (
                <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <FileCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    Scorecard phỏng vấn
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Các luận điểm một câu trả lời tốt cần thể hiện.
                  </p>
                  <ol className="mt-3 grid gap-2">
                    {rubricItems.map((item, index) => (
                      <li
                        key={item}
                        className="flex gap-2.5 text-sm leading-5 text-slate-700 dark:text-slate-300"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          {index + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {question.answer.commonMistakes && (
                <section className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-950 dark:bg-rose-950/15">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-rose-800 dark:text-rose-200">
                    <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    Bẫy cần tránh
                  </h3>
                  <div className="mt-3 text-sm leading-5 text-rose-900 dark:text-rose-300">
                    {Array.isArray(question.answer.commonMistakes) ? (
                      <ul className="space-y-1.5">
                        {question.answer.commonMistakes.map((mistake: string, i: number) => (
                          <li key={i} className="flex gap-2">
                            <span aria-hidden="true">•</span>
                            <span>{mistake}</span>
                          </li>
                        ))}
                      </ul>
                    ) : typeof question.answer.commonMistakes === 'string' ? (
                      <p>{question.answer.commonMistakes}</p>
                    ) : null}
                  </div>
                </section>
              )}
            </div>

            {/* Official Disclaimer */}
            <div className="flex items-start gap-2.5 px-1 py-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
              <span>{question.disclaimer}</span>
            </div>
          </div>
        ) : (
          /* Locked Answer Callout */
          <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-gradient-to-b from-indigo-50/50 to-white p-8 text-center dark:border-indigo-900 dark:from-indigo-950/20 dark:to-slate-900">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Lock className="h-7 w-7" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Đáp án tham khảo & Tiêu chí chấm điểm (Rubric)
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
              Mở đáp án để xem lời giải mẫu, phân tích độ phức tạp, thang điểm Rubric và các lỗi
              thường gặp được tổng hợp bởi đội ngũ chuyên gia.
            </p>

            <div className="mt-6 flex justify-center">
              <Button
                variant="primary"
                size="lg"
                onClick={() => revealMutation.mutate()}
                isLoading={revealMutation.isPending}
                className="flex items-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                <Unlock className="h-5 w-5" />
                Mở đáp án tham khảo
              </Button>
            </div>

            {revealError && (
              <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">
                {revealError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Related Questions */}
      {question.relatedQuestions && question.relatedQuestions.length > 0 && (
        <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5">
            Câu hỏi liên quan cùng chủ đề
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {question.relatedQuestions.map(rel => (
              <QuestionCard key={rel.id} question={rel} />
            ))}
          </div>
        </div>
      )}

      {/* Paywall Modal */}
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        onSubmit={handleFeedbackSubmit}
      />
    </div>
  );
}
