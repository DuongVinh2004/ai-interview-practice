import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { formatScore, formatDifficulty } from '../../lib/utils';
import { useI18nStore } from '../../stores/i18n.store';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { History, PlayCircle, ChevronRight, Calendar, Search, X, ChevronLeft } from 'lucide-react';

export function HistoryPage() {
  const { t, language } = useI18nStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sessionMode, setSessionMode] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [scoreTier, setScoreTier] = useState<string>('');

  let minScore: number | undefined = undefined;
  let maxScore: number | undefined = undefined;
  if (scoreTier === 'high') {
    minScore = 8.0;
  } else if (scoreTier === 'medium') {
    minScore = 6.0;
    maxScore = 7.9;
  } else if (scoreTier === 'low') {
    maxScore = 5.9;
  }

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: '10',
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(sessionMode ? { sessionMode } : {}),
    ...(status ? { state: status } : {}),
    ...(minScore !== undefined ? { minScore: String(minScore) } : {}),
    ...(maxScore !== undefined ? { maxScore: String(maxScore) } : {}),
  });

  const { data, isLoading } = useQuery<{ items: any[]; meta: any }>({
    queryKey: ['interview-history', page, search, sessionMode, status, scoreTier],
    queryFn: () => apiClient(`/interviews/history?${queryParams.toString()}`),
  });

  const sessions = data?.items || [];
  const meta = data?.meta;

  const handleClearFilters = () => {
    setSearch('');
    setSessionMode('');
    setStatus('');
    setScoreTier('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || sessionMode || status || scoreTier);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <History className="h-6 w-6 text-indigo-600" />
            <span>
              {language === 'vi' ? 'Lịch Sử Luyện Tập Phỏng Vấn' : 'Your Interview History'}
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {language === 'vi'
              ? 'Xem lại bảng điểm rubric, trích dẫn bằng chứng và lộ trình củng cố kỹ năng'
              : 'Review past mock interviews, score progression, and drill results'}
          </p>
        </div>
        <Link to="/interviews/new">
          <Button className="gap-2" leftIcon={<PlayCircle className="h-4 w-4" />}>
            <span>{t.nav.newInterview}</span>
          </Button>
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <Card className="border-slate-200 shadow-xs p-4 bg-slate-50/50">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t.historyFilters.searchPlaceholder}
                aria-label="Search interviews"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs gap-1 text-slate-500 hover:text-slate-800"
              >
                <X className="h-3.5 w-3.5" />
                <span>{t.historyFilters.clearFilters}</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {/* Mode filter */}
            <select
              value={sessionMode}
              onChange={e => {
                setSessionMode(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by session mode"
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">{t.historyFilters.allModes}</option>
              <option value="STANDARD">{t.practice.standard}</option>
              <option value="FOCUSED_REMEDIATION">{t.practice.remediation}</option>
              <option value="QUICK_PRACTICE">{t.practice.sandbox}</option>
            </select>

            {/* Status filter */}
            <select
              value={status}
              onChange={e => {
                setStatus(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by state"
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">{t.historyFilters.allStates}</option>
              <option value="COMPLETED">{language === 'vi' ? 'Đã hoàn thành' : 'Completed'}</option>
              <option value="ACTIVE">{language === 'vi' ? 'Đang diễn ra' : 'In Progress'}</option>
              <option value="CREATED">{language === 'vi' ? 'Mới khởi tạo' : 'Created'}</option>
              <option value="FAILED">{language === 'vi' ? 'Không thành công' : 'Failed'}</option>
            </select>

            {/* Score filter */}
            <select
              value={scoreTier}
              onChange={e => {
                setScoreTier(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by score tier"
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">{t.historyFilters.allScores}</option>
              <option value="high">{t.historyFilters.highScore}</option>
              <option value="medium">{t.historyFilters.mediumScore}</option>
              <option value="low">{t.historyFilters.lowScore}</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Results List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton variant="card" height={90} />
          <Skeleton variant="card" height={90} />
          <Skeleton variant="card" height={90} />
        </div>
      ) : sessions.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="flex flex-col items-center gap-3">
            <History className="h-10 w-10 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-800">
              {hasActiveFilters
                ? language === 'vi'
                  ? 'Không tìm thấy phiên phỏng vấn phù hợp'
                  : 'No matching sessions found'
                : language === 'vi'
                  ? 'Chưa có phiên phỏng vấn nào'
                  : 'No interview sessions found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {hasActiveFilters
                ? language === 'vi'
                  ? 'Hãy thử điều chỉnh bộ lọc hoặc xóa điều kiện tìm kiếm.'
                  : 'Try adjusting your search criteria or resetting filters.'
                : language === 'vi'
                  ? 'Bạn chưa hoàn thành phiên luyện tập nào. Bắt đầu phiên phỏng vấn đầu tiên ngay!'
                  : "You haven't completed any practice sessions yet. Start your first mock interview now!"}
            </p>
            {hasActiveFilters ? (
              <Button size="sm" variant="outline" onClick={handleClearFilters} className="mt-2">
                {t.historyFilters.clearFilters}
              </Button>
            ) : (
              <Link to="/interviews/new" className="mt-2">
                <Button size="sm">
                  {language === 'vi' ? 'Bắt đầu Luyện tập' : 'Start Practice'}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const diff = formatDifficulty(s.targetDifficulty);
            const isRemediation = s.sessionMode === 'FOCUSED_REMEDIATION';
            const isSandbox = s.isSandbox || s.sessionMode === 'QUICK_PRACTICE';

            return (
              <Card key={s.id} className="hover:border-slate-300 transition-colors shadow-xs">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {s.jobRole.name} • {s.seniorityLevel.name}
                      </span>
                      <Badge variant={s.state === 'COMPLETED' ? 'success' : 'default'}>
                        {s.state === 'COMPLETED'
                          ? language === 'vi'
                            ? 'Hoàn thành'
                            : 'Completed'
                          : s.state === 'ACTIVE'
                            ? language === 'vi'
                              ? 'Đang thực hiện'
                              : 'In Progress'
                            : s.state}
                      </Badge>
                      {isRemediation && (
                        <Badge variant="warning" className="text-[10px]">
                          {language === 'vi' ? 'Luyện Trọng Tâm' : 'Focused Remediation'}
                        </Badge>
                      )}
                      {isSandbox && (
                        <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                          Sandbox
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${diff.color}`}
                      >
                        {diff.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span>
                        Stack: {s.technologies.map((t: any) => t.name).join(', ') || 'General'}
                      </span>
                      <span>•</span>
                      <span>
                        {language === 'vi' ? 'Lượt' : 'Turns'}: {s.currentTurn}/{s.totalTurns}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    {s.overallScore !== null && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-medium">
                          {language === 'vi' ? 'Điểm' : 'Score'}
                        </span>
                        <span className="font-bold text-base text-emerald-700 font-mono">
                          {formatScore(s.overallScore)}/10
                        </span>
                      </div>
                    )}
                    <Link
                      to={
                        s.state === 'COMPLETED'
                          ? `/interviews/${s.id}/result`
                          : `/interviews/${s.id}`
                      }
                    >
                      <Button variant="outline" size="sm" className="gap-1">
                        <span>
                          {s.state === 'COMPLETED'
                            ? language === 'vi'
                              ? 'Xem Kết Quả (View Result)'
                              : 'View Result'
                            : language === 'vi'
                              ? 'Tiếp tục'
                              : 'Continue'}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination Controls */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={!meta.hasPrevPage}
                className="gap-1 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>{language === 'vi' ? 'Trang trước' : 'Previous'}</span>
              </Button>
              <span className="text-xs text-slate-500 font-medium">
                {language === 'vi'
                  ? `Trang ${meta.page} / ${meta.totalPages} (${meta.total} phiên)`
                  : `Page ${meta.page} of ${meta.totalPages} (${meta.total} sessions)`}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={!meta.hasNextPage}
                className="gap-1 text-xs"
              >
                <span>{language === 'vi' ? 'Trang sau' : 'Next'}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default HistoryPage;
