import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { QuestionBankQuestionDto } from '@ai-interview/contracts';
import { QuestionCard } from './components/QuestionCard';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ArrowLeft, Bookmark, AlertCircle } from 'lucide-react';

export function BookmarkedQuestionsPage() {
  const queryClient = useQueryClient();
  const [page] = useState(1);

  const {
    data: bookmarksData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['question-bank-bookmarks', page],
    queryFn: async () => {
      const res = await apiClient<any>(`/question-bank/bookmarks?page=${page}&limit=12`);
      return res.data ? res : { data: res, meta: { total: 0, page: 1, totalPages: 1 } };
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      return apiClient(`/question-bank/questions/${id}/bookmark`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-bank-bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['question-bank-questions'] });
    },
  });

  const questions: QuestionBankQuestionDto[] = bookmarksData?.data || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            to="/question-bank"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Ngân hàng câu hỏi
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl flex items-center gap-2.5">
            <Bookmark className="h-7 w-7 text-amber-500 fill-amber-500" />
            Câu hỏi phỏng vấn đã lưu
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Xem lại danh sách các câu hỏi bạn đã đánh dấu để ôn tập chuyên sâu.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <Skeleton className="h-5 w-24 mb-3" />
              <Skeleton className="h-6 w-full mb-2" />
              <Skeleton className="h-12 w-full mb-4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/50 dark:bg-rose-950/30">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
          <h3 className="mt-2 text-base font-semibold text-rose-800 dark:text-rose-200">
            Không thể tải danh sách câu hỏi đã lưu
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['question-bank-bookmarks'] })}
          >
            Thử lại
          </Button>
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center dark:border-slate-800 dark:bg-slate-900/50">
          <Bookmark className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-3 text-base font-semibold text-slate-800 dark:text-white">
            Bạn chưa lưu câu hỏi nào
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Khi duyệt ngân hàng câu hỏi, bấm biểu tượng Bookmark trên bất kỳ câu hỏi nào để lưu vào
            danh sách này.
          </p>
          <Link to="/question-bank" className="mt-5 inline-block">
            <Button variant="primary">Khám phá Ngân hàng câu hỏi</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {questions.map(q => (
              <QuestionCard
                key={q.id}
                question={q}
                onToggleBookmark={id => bookmarkMutation.mutate({ id })}
                isBookmarkLoading={bookmarkMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
