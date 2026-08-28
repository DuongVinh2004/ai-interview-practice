import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { QuestionBankQuestionDto, QuestionBankAccessStatusDto } from '@ai-interview/contracts';
import { QuestionCard } from './components/QuestionCard';
import { QuestionFilterSidebar } from './components/QuestionFilterSidebar';
import { PaywallModal } from './components/PaywallModal';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuthStore } from '../../stores/auth.store';
import {
  BookOpen,
  Bookmark,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  AlertCircle,
} from 'lucide-react';

export function QuestionBankLandingPage() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [seniority, setSeniority] = useState('');
  const [difficulty, setDifficulty] = useState<number | undefined>(undefined);
  const [questionType, setQuestionType] = useState('');
  const [language, setLanguage] = useState('vi');

  const [showPaywall, setShowPaywall] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Fetch Questions
  const {
    data: questionsData,
    isLoading: isQuestionsLoading,
    isError: isQuestionsError,
  } = useQuery({
    queryKey: [
      'question-bank-questions',
      page,
      search,
      role,
      seniority,
      difficulty,
      questionType,
      language,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '9',
      });
      if (search) params.append('search', search);
      if (role) params.append('role', role);
      if (seniority) params.append('seniority', seniority);
      if (difficulty) params.append('difficulty', difficulty.toString());
      if (questionType) params.append('questionType', questionType);
      if (language) params.append('language', language);

      const res = await apiClient<any>(`/question-bank/questions?${params.toString()}`);
      return res.data ? res : { data: res, meta: { total: 0, page: 1, totalPages: 1 } };
    },
  });

  // Fetch Access Status (Entitlement / Quota)
  const { data: accessStatus } = useQuery<QuestionBankAccessStatusDto>({
    queryKey: ['question-bank-access-status'],
    queryFn: async () => {
      const res = await apiClient<any>('/question-bank/access-status');
      return res.data || res;
    },
    enabled: isAuthenticated,
  });

  // Fetch Taxonomy for filters
  const { data: taxonomyRoles } = useQuery({
    queryKey: ['taxonomy-roles'],
    queryFn: async () => {
      const res = await apiClient<any>('/taxonomies/job-roles');
      return res.data || res || [];
    },
  });

  const { data: taxonomySeniorities } = useQuery({
    queryKey: ['taxonomy-seniorities'],
    queryFn: async () => {
      const res = await apiClient<any>('/taxonomies/levels');
      return res.data || res || [];
    },
  });

  // Bookmark Mutation
  const bookmarkMutation = useMutation({
    mutationFn: async ({ id, isBookmarked }: { id: string; isBookmarked: boolean }) => {
      if (isBookmarked) {
        return apiClient(`/question-bank/questions/${id}/bookmark`, { method: 'DELETE' });
      } else {
        return apiClient(`/question-bank/questions/${id}/bookmark`, { method: 'POST' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-bank-questions'] });
      queryClient.invalidateQueries({ queryKey: ['question-bank-bookmarks'] });
    },
  });

  const handleResetFilters = () => {
    setSearch('');
    setRole('');
    setSeniority('');
    setDifficulty(undefined);
    setQuestionType('');
    setLanguage('vi');
    setPage(1);
  };

  const questions: QuestionBankQuestionDto[] = questionsData?.data || [];
  const meta = questionsData?.meta || { total: 0, totalPages: 1, page: 1 };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Banner / Hero Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 text-white shadow-xl sm:p-8 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
            <BookOpen className="h-4 w-4" />
            Thư viện chuẩn hóa
          </div>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
            Ngân hàng câu hỏi phỏng vấn IT & AI
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-indigo-100/90">
            Kho câu hỏi kiểm duyệt kỹ lưỡng kèm đáp án tham khảo, tiêu chí chấm điểm (Rubric) và
            nhận diện các lỗi thường gặp theo từng vị trí và cấp bậc.
          </p>
        </div>

        {/* Quota Indicator & Actions */}
        <div className="flex flex-col gap-3 sm:flex-row md:flex-col md:items-end">
          {isAuthenticated && accessStatus && (
            <div className="rounded-xl border border-indigo-700/50 bg-indigo-950/60 p-3.5 backdrop-blur">
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="text-indigo-200 font-medium">Lượt mở đáp án tháng này:</span>
                <span className="font-bold text-white">
                  {accessStatus.revealsUsed} /{' '}
                  {accessStatus.revealsLimit === 'unlimited' ? '∞' : accessStatus.revealsLimit}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-indigo-300">
                <span>
                  Gói hiện tại:{' '}
                  <strong className="uppercase text-white">{accessStatus.planSlug}</strong>
                </span>
                {accessStatus.planSlug === 'free' && (
                  <button
                    onClick={() => setShowPaywall(true)}
                    className="font-semibold text-amber-300 hover:underline inline-flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" /> Nâng cấp Pro
                  </button>
                )}
              </div>
            </div>
          )}

          <Link to="/question-bank/bookmarks">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-indigo-400/40 bg-indigo-900/40 text-white hover:bg-indigo-800/60 hover:text-white"
            >
              <Bookmark className="mr-2 h-4 w-4 text-amber-400" />
              Câu hỏi đã lưu
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Grid: Filters + Question Cards */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Sidebar on Desktop */}
        <div className="hidden lg:block lg:col-span-1">
          <QuestionFilterSidebar
            search={search}
            onSearchChange={s => {
              setSearch(s);
              setPage(1);
            }}
            role={role}
            onRoleChange={r => {
              setRole(r);
              setPage(1);
            }}
            seniority={seniority}
            onSeniorityChange={sn => {
              setSeniority(sn);
              setPage(1);
            }}
            difficulty={difficulty}
            onDifficultyChange={d => {
              setDifficulty(d);
              setPage(1);
            }}
            questionType={questionType}
            onQuestionTypeChange={t => {
              setQuestionType(t);
              setPage(1);
            }}
            language={language}
            onLanguageChange={l => {
              setLanguage(l);
              setPage(1);
            }}
            onReset={handleResetFilters}
            roles={taxonomyRoles}
            seniorities={taxonomySeniorities}
          />
        </div>

        {/* Mobile Filter Toggle */}
        <div className="flex items-center justify-between lg:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            {mobileFilterOpen ? 'Ẩn bộ lọc' : 'Bộ lọc tìm kiếm'}
          </Button>
          <span className="text-xs text-slate-500">Tìm thấy {meta.total || 0} câu hỏi</span>
        </div>

        {mobileFilterOpen && (
          <div className="lg:hidden">
            <QuestionFilterSidebar
              search={search}
              onSearchChange={s => {
                setSearch(s);
                setPage(1);
              }}
              role={role}
              onRoleChange={r => {
                setRole(r);
                setPage(1);
              }}
              seniority={seniority}
              onSeniorityChange={sn => {
                setSeniority(sn);
                setPage(1);
              }}
              difficulty={difficulty}
              onDifficultyChange={d => {
                setDifficulty(d);
                setPage(1);
              }}
              questionType={questionType}
              onQuestionTypeChange={t => {
                setQuestionType(t);
                setPage(1);
              }}
              language={language}
              onLanguageChange={l => {
                setLanguage(l);
                setPage(1);
              }}
              onReset={handleResetFilters}
              roles={taxonomyRoles}
              seniorities={taxonomySeniorities}
            />
          </div>
        )}

        {/* Question Cards Area */}
        <div className="lg:col-span-3">
          {isQuestionsLoading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="mt-4 h-6 w-full" />
                  <Skeleton className="mt-2 h-14 w-full" />
                  <Skeleton className="mt-4 h-5 w-24" />
                </div>
              ))}
            </div>
          ) : isQuestionsError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/50 dark:bg-rose-950/30">
              <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
              <h3 className="mt-2 text-base font-semibold text-rose-800 dark:text-rose-200">
                Không thể tải danh sách câu hỏi
              </h3>
              <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">
                Vui lòng thử tải lại trang hoặc kiểm tra kết nối mạng.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ['question-bank-questions'] })
                }
              >
                Thử lại
              </Button>
            </div>
          ) : questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center dark:border-slate-800 dark:bg-slate-900/50">
              <Layers className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="mt-3 text-base font-semibold text-slate-800 dark:text-white">
                Không tìm thấy câu hỏi phù hợp
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Thử thay đổi từ khóa hoặc điều chỉnh các tiêu chí bộ lọc.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleResetFilters}>
                Xóa tất cả bộ lọc
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {questions.map(q => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    onToggleBookmark={(id, isBookmarked) =>
                      bookmarkMutation.mutate({ id, isBookmarked })
                    }
                    isBookmarkLoading={bookmarkMutation.isPending}
                  />
                ))}
              </div>

              {/* Pagination */}
              {meta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Trang <strong>{meta.page}</strong> / <strong>{meta.totalPages}</strong> (Tổng{' '}
                    {meta.total} câu hỏi)
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Trước
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.page >= meta.totalPages}
                      onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                    >
                      Sau
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        resetsAt={accessStatus?.periodResetsAt}
        planSlug={accessStatus?.planSlug}
      />
    </div>
  );
}
