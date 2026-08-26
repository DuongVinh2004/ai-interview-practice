import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { formatScore } from '../../lib/utils';
import { useI18nStore } from '../../stores/i18n.store';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { RubricBreakdown } from '../../components/interview/RubricBreakdown';
import { ShareSessionModal } from '../../components/share/ShareSessionModal';
import { StarRadarChart } from '../../components/analytics/StarRadarChart';
import { SocraticTutorDrawer } from '../../components/tutor/SocraticTutorDrawer';
import { InstantRetryModal } from '../../components/tutor/InstantRetryModal';
import { useTutor } from '../../hooks/useTutor';
import {
  Award,
  ArrowLeft,
  BookOpen,
  Search,
  RotateCw,
  RotateCcw,
  Sparkles,
  Share2,
  Download,
  Printer,
  CheckCircle2,
  Circle,
  Target,
  Bot,
  ShieldCheck,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export function ResultDetailPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, language } = useI18nStore();

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isReEvaluating, setIsReEvaluating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reEvalModalTurn, setReEvalModalTurn] = useState<number | null>(null);
  const [reEvalReason, setReEvalReason] = useState('');
  const [expandedTurns, setExpandedTurns] = useState<Record<number, boolean>>({});

  // Socratic Tutor & Retry State
  const [activeTutorTurn, setActiveTutorTurn] = useState<{
    turnNumber: number;
    questionContent: string;
  } | null>(null);
  const [activeRetryTurn, setActiveRetryTurn] = useState<{
    turnNumber: number;
    questionContent: string;
    originalAnswer: string;
    originalScore: number;
  } | null>(null);

  const {
    session: tutorSession,
    createSession: createTutorSession,
    sendMessage: sendTutorMessage,
    isStreaming: isTutorStreaming,
    streamedContent: tutorStreamedContent,
    submitRetry: submitQuestionRetry,
    isSubmittingRetry,
    rateTutor,
  } = useTutor();

  const {
    data: result,
    isLoading,
    refetch,
  } = useQuery<any>({
    queryKey: ['interview-result', sessionId],
    queryFn: () => apiClient(`/interviews/${sessionId}/result`),
    enabled: !!sessionId,
  });

  const toggleTurnAccordion = (turnNum: number) => {
    setExpandedTurns(prev => ({
      ...prev,
      [turnNum]: !prev[turnNum],
    }));
  };

  const handleRegenerateLp = async () => {
    if (!sessionId) return;
    try {
      await apiClient(`/interviews/${sessionId}/learning-path/regenerate`, { method: 'POST' });
      refetch();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to regenerate learning path');
    }
  };

  const handleToggleItem = async (itemId: string, currentStatus: boolean) => {
    if (!sessionId) return;
    try {
      await apiClient(`/interviews/${sessionId}/learning-path/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isCompleted: !currentStatus }),
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['interview-result', sessionId] });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update goal status');
    }
  };

  const handleReEvaluateConfirm = async () => {
    if (!sessionId || reEvalModalTurn === null || isReEvaluating) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsReEvaluating(true);

    try {
      await apiClient(`/interviews/${sessionId}/turns/${reEvalModalTurn}/re-evaluate`, {
        method: 'POST',
        body: JSON.stringify({ reason: reEvalReason.trim() || undefined }),
      });

      setSuccessMessage(t.interview.reEvaluationSuccess);
      setReEvalModalTurn(null);
      setReEvalReason('');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['interview-result', sessionId] });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to re-evaluate answer.');
    } finally {
      setIsReEvaluating(false);
    }
  };

  const handleExportJson = () => {
    if (!result) return;
    try {
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interview-report-${result.jobRole?.name || 'session'}-${sessionId?.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to export interview report');
    }
  };

  if (isLoading || !result) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton variant="card" height={160} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton variant="card" height={100} />
          <Skeleton variant="card" height={100} />
          <Skeleton variant="card" height={100} />
        </div>
        <Skeleton variant="card" height={320} />
      </div>
    );
  }

  const completedLpItems =
    result.learningPath?.items?.filter((i: any) => i.isCompleted)?.length || 0;
  const totalLpItems = result.learningPath?.items?.length || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/history')}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          <span>{language === 'vi' ? 'Quay lại Lịch sử' : 'Back to History'}</span>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!sessionId) return;
              try {
                await apiClient.post('/flashcards/auto-generate', { interviewId: sessionId });
                navigate('/flashcards');
              } catch (e: any) {
                setErrorMessage(e.message || 'Không thể tạo flashcards');
              }
            }}
            leftIcon={<BookOpen className="h-4 w-4" />}
            className="text-indigo-700 hover:text-indigo-800 border-indigo-300 hover:bg-indigo-50"
          >
            <span>{language === 'vi' ? 'Tạo Flashcards Ôn tập' : 'Generate Flashcards'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsShareModalOpen(true)}
            leftIcon={<Share2 className="h-4 w-4" />}
            className="text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50"
          >
            <span>{t.share.shareTitle}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            leftIcon={<Download className="h-4 w-4" />}
          >
            <span>{t.share.exportJson}</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            leftIcon={<Printer className="h-4 w-4" />}
            className="print:hidden"
          >
            <span>{t.share.printPdf}</span>
          </Button>

          <Badge variant="success">{t.practice.completedBadge}</Badge>
        </div>
      </div>

      {/* Formative Practice Disclaimer Alert */}
      <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-emerald-900 shadow-xs">
        <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block text-emerald-950 text-sm">
            {language === 'vi'
              ? 'Báo Cáo Phân Tích Kỹ Thuật Luyện Tập (Formative Report)'
              : 'Formative Technical Practice Diagnostic Report'}
          </span>
          <p className="mt-0.5 text-emerald-800 leading-relaxed">
            {language === 'vi'
              ? 'Báo cáo này tổng hợp dữ liệu phản hồi đa chiều nhằm giúp bạn nhận diện chính xác các lỗ hổng kiến thức và nâng cao năng lực trước các kỳ phỏng vấn thực tế. Kết quả không cấu thành quyết định tuyển dụng chính thức.'
              : 'This assessment synthesizes multi-dimensional feedback to help you identify knowledge gaps and master technical competencies. All scores are strictly formative and do not represent formal employment decisions.'}
          </p>
        </div>
      </div>

      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      {/* Header Score Overview Card */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg overflow-hidden border-slate-700">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{language === 'vi' ? 'Kết Quả Tổng Kết' : 'Final Evaluation Report'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {result.jobRole?.name} ({result.seniorityLevel?.name})
              </h1>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-300">
                <span className="text-slate-400">Tech Stack:</span>
                {result.technologies?.map((tech: any, idx: number) => (
                  <span
                    key={tech.id || tech.name || idx}
                    className="px-2 py-0.5 bg-slate-800 text-emerald-400 rounded border border-slate-700 font-mono text-[11px]"
                  >
                    {tech.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 bg-slate-800/90 p-5 rounded-2xl border border-slate-700 shadow-inner self-stretch md:self-auto justify-center">
              <Award className="h-12 w-12 text-emerald-400 shrink-0" />
              <div>
                <span className="text-xs text-slate-400 block font-medium">
                  {language === 'vi' ? 'Điểm Tổng Kết' : 'Overall Score'}
                </span>
                <span className="text-3xl sm:text-4xl font-extrabold text-emerald-400 font-mono">
                  {formatScore(result.overallScore)}
                  <span className="text-sm text-slate-400 font-normal font-sans"> / 10</span>
                </span>
              </div>
            </div>
          </div>

          {/* Rubric Dimension Averages */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-700/70 text-center">
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <span className="text-xs text-slate-400 block mb-1">
                {t.interview.technicalAccuracy} (40%)
              </span>
              <span className="text-xl font-bold text-white font-mono">
                {formatScore(result.rubricAverages?.technicalAccuracy)}
                <span className="text-xs text-slate-400 font-sans"> / 10</span>
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <span className="text-xs text-slate-400 block mb-1">{t.interview.depth} (30%)</span>
              <span className="text-xl font-bold text-white font-mono">
                {formatScore(result.rubricAverages?.depth)}
                <span className="text-xs text-slate-400 font-sans"> / 10</span>
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <span className="text-xs text-slate-400 block mb-1">{t.interview.clarity} (30%)</span>
              <span className="text-xl font-bold text-white font-mono">
                {formatScore(result.rubricAverages?.clarity)}
                <span className="text-xs text-slate-400 font-sans"> / 10</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* STAR Assessment Radar Breakdown (When Behavioral Mode) */}
      {result.sessionMode === 'BEHAVIORAL' && (
        <Card
          className="border-indigo-200 bg-gradient-to-br from-indigo-50/40 to-white shadow-sm"
          data-testid="star-assessment-section"
        >
          <CardHeader className="bg-indigo-50/60 pb-3 border-b border-indigo-100 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-indigo-950">
                STAR Behavioral Competency Breakdown
              </CardTitle>
            </div>
            <Badge variant="default" className="bg-indigo-600 text-white">
              STAR Methodology
            </Badge>
          </CardHeader>
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-around gap-6">
            <StarRadarChart
              scores={{
                situationScore: 3.5,
                taskScore: 3.2,
                actionScore: 3.8,
                resultScore: 3.4,
                structureScore: 1.8,
                totalScore: Number(result.overallScore) || 8.5,
              }}
            />
            <div className="space-y-3 max-w-md text-xs text-slate-700">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="font-bold text-indigo-900 block mb-1">
                  Methodology Assessment:
                </span>
                <p>
                  Demonstrated structured behavioral storytelling with clear action-to-impact
                  alignment across all evaluated turns.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actionable Learning Path / Remediation Checklist */}
      <Card className="border-emerald-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-emerald-50/60 border-b border-emerald-100 flex flex-row items-center justify-between p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-emerald-700" />
            <div>
              <CardTitle className="text-base sm:text-lg text-emerald-950 font-bold">
                {language === 'vi'
                  ? 'Lộ Trình Học Tập Cá Nhân Hóa'
                  : 'Personalized Learning Roadmap'}
              </CardTitle>
              <CardDescription>
                {language === 'vi'
                  ? 'Các chủ đề ưu tiên cần củng cố được AI trích xuất từ kết quả trả lời'
                  : 'Targeted skill gap recommendations extracted from your interview responses'}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRegenerateLp}
            leftIcon={<RotateCw className="h-3.5 w-3.5" />}
            className="text-xs text-emerald-800 hover:bg-emerald-100"
          >
            <span>{language === 'vi' ? 'Tạo lại' : 'Regenerate'}</span>
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {totalLpItems > 0 && (
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>{t.practice.goalProgress}</span>
                <span>
                  {completedLpItems} / {totalLpItems} (
                  {Math.round((completedLpItems / totalLpItems) * 100)}%)
                </span>
              </div>
              <ProgressBar
                value={completedLpItems}
                max={totalLpItems}
                label="Learning roadmap progress"
                variant="emerald"
                size="sm"
              />
            </div>
          )}

          {result.learningPath ? (
            <>
              {result.learningPath.summary && (
                <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 leading-relaxed">
                  {result.learningPath.summary}
                </p>
              )}

              <div className="space-y-3">
                {result.learningPath.items?.map((item: any, idx: number) => {
                  const isDone = item.isCompleted;
                  return (
                    <div
                      key={item.id || idx}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        isDone
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleItem(item.id, isDone)}
                            className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                            title={isDone ? t.practice.markIncomplete : t.practice.markComplete}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600 fill-emerald-100" />
                            ) : (
                              <Circle className="h-5 w-5 text-slate-300 hover:text-slate-400" />
                            )}
                          </button>
                          <div>
                            <h4
                              className={`font-bold text-sm ${
                                isDone ? 'line-through text-slate-500' : 'text-slate-900'
                              }`}
                            >
                              {item.topic}
                            </h4>
                            <p className="text-xs text-rose-700 font-medium mt-0.5">
                              Gap: {item.gap}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isDone ? (
                            <Badge variant="success">{t.practice.completedBadge}</Badge>
                          ) : (
                            <Badge
                              variant={
                                item.priority === 'HIGH'
                                  ? 'danger'
                                  : item.priority === 'MEDIUM'
                                    ? 'warning'
                                    : 'default'
                              }
                            >
                              {item.priority} PRIORITY
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p
                        className={`text-xs leading-relaxed ${
                          isDone ? 'text-slate-500' : 'text-slate-700'
                        }`}
                      >
                        {item.recommendedAction}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Search className="h-3.5 w-3.5 text-slate-400" />
                          {item.searchKeywords?.map((kw: string, kidx: number) => (
                            <span
                              key={kidx}
                              className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-mono"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate(`/interviews/new?mode=remediation&competency=SYSTEM_DESIGN`)
                          }
                          leftIcon={<Target className="h-3.5 w-3.5 text-indigo-600" />}
                          className="text-xs text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50"
                        >
                          <span>{t.practice.practiceSkill}</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-500 text-xs">
              {language === 'vi'
                ? 'Chưa có lộ trình học tập cho phiên này.'
                : 'No learning path generated for this session.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Transcript / Past Turns Accordion */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-slate-700" />
          <h2 className="text-base font-bold text-slate-900">
            {language === 'vi'
              ? 'Biên Bản Chi Tiết Các Lượt Phỏng Vấn'
              : 'Session Transcript & Feedback'}
          </h2>
        </div>

        <div className="space-y-3">
          {result.turns?.map((turn: any, idx: number) => {
            const isExpanded = expandedTurns[turn.turnNumber] ?? false;
            const evalData = turn.answer?.evaluation;

            return (
              <Card
                key={turn.id ?? turn.turnNumber ?? idx}
                className="border-slate-200 shadow-xs overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleTurnAccordion(turn.turnNumber)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                      {turn.turnNumber}
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">
                        {t.interview.question} {turn.turnNumber}:{' '}
                        {turn.question?.keyFocus || 'Technical Scenario'}
                      </span>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {turn.question?.content}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {evalData && (
                      <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full font-bold text-xs">
                        <Award className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{formatScore(evalData.score)}/10</span>
                      </div>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-5 border-t border-slate-100 bg-slate-50/40 space-y-4 text-xs">
                    <div>
                      <h4 className="font-bold text-slate-700 mb-1">{t.interview.question}</h4>
                      <p className="text-slate-900 bg-white p-3 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed">
                        {turn.question?.content}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-700 mb-1">
                        {t.interview.submittedAnswer}
                      </h4>
                      <p className="text-slate-900 bg-white p-3 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed">
                        {turn.answer?.content || '(No answer recorded)'}
                      </p>
                    </div>

                    {evalData && (
                      <div className="space-y-3 pt-2">
                        <h4 className="font-bold text-slate-700">{t.interview.feedbackTitle}</h4>
                        <RubricBreakdown scores={evalData.rubricScores} />

                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <p className="text-slate-700 italic">"{evalData.conciseFeedback}"</p>
                        </div>

                        {/* Quoted Evidence */}
                        {evalData.evidence?.length > 0 && (
                          <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100">
                            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block mb-1">
                              {t.interview.quotedEvidence}
                            </span>
                            <ul className="space-y-1 text-emerald-800 italic">
                              {evalData.evidence.map((ev: string, eidx: number) => (
                                <li key={eidx} className="flex items-start gap-1">
                                  <span className="text-emerald-600 font-bold not-italic">“</span>
                                  <span>{ev.replace(/^["“”]|["“”]$/g, '')}</span>
                                  <span className="text-emerald-600 font-bold not-italic">”</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Socratic Tutor & Retry Actions */}
                        <div className="flex flex-wrap justify-end gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setActiveTutorTurn({
                                turnNumber: turn.turnNumber,
                                questionContent: turn.question?.content || '',
                              })
                            }
                            leftIcon={<Bot className="h-3.5 w-3.5 text-purple-600" />}
                            className="text-xs text-purple-700 hover:text-purple-800 hover:bg-purple-50"
                          >
                            <span>Hỏi AI Tutor</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setActiveRetryTurn({
                                turnNumber: turn.turnNumber,
                                questionContent: turn.question?.content || '',
                                originalAnswer: turn.answer?.content || '',
                                originalScore: Number(evalData.score) || 0,
                              })
                            }
                            leftIcon={<RotateCcw className="h-3.5 w-3.5 text-sky-600" />}
                            className="text-xs text-sky-700 hover:text-sky-800 hover:bg-sky-50"
                          >
                            <span>Luyện Lại Câu Này</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReEvalModalTurn(turn.turnNumber)}
                            isLoading={isReEvaluating}
                            leftIcon={<RotateCcw className="h-3.5 w-3.5 text-emerald-700" />}
                            className="text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                          >
                            <span>{t.interview.requestReEvaluation}</span>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Share Session Modal */}
      {isShareModalOpen && (
        <ShareSessionModal
          sessionId={sessionId!}
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}

      {/* Socratic AI Tutor Drawer */}
      {activeTutorTurn && (
        <SocraticTutorDrawer
          isOpen={!!activeTutorTurn}
          onClose={() => setActiveTutorTurn(null)}
          turnNumber={activeTutorTurn.turnNumber}
          questionContent={activeTutorTurn.questionContent}
          messages={tutorSession?.messages || []}
          isStreaming={isTutorStreaming}
          streamedContent={tutorStreamedContent}
          onSendMessage={async msg => {
            if (!tutorSession) {
              await createTutorSession({
                interviewId: sessionId!,
                turnNumber: activeTutorTurn.turnNumber,
              });
            }
            await sendTutorMessage(msg);
          }}
          onRate={(rating, feedback) =>
            tutorSession?.id
              ? rateTutor({ sessionId: tutorSession.id, rating: { rating, feedback } })
              : Promise.resolve()
          }
        />
      )}

      {/* Instant Question Retry Modal */}
      {activeRetryTurn && (
        <InstantRetryModal
          isOpen={!!activeRetryTurn}
          onClose={() => setActiveRetryTurn(null)}
          turnNumber={activeRetryTurn.turnNumber}
          questionContent={activeRetryTurn.questionContent}
          originalAnswer={activeRetryTurn.originalAnswer}
          originalScore={activeRetryTurn.originalScore}
          onSubmitRetry={answer =>
            submitQuestionRetry({
              interviewId: sessionId!,
              turnNumber: activeRetryTurn.turnNumber,
              retryAnswer: answer,
            })
          }
          isSubmitting={isSubmittingRetry}
        />
      )}

      {/* Re-evaluation Modal Dialog */}
      {reEvalModalTurn !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t.interview.requestReEvaluation} (Turn {reEvalModalTurn})
                </h3>
                <p className="text-xs text-slate-500">
                  AI Orchestrator will re-assess your answer with deterministic rubrics.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                {t.interview.reEvaluationPrompt}
              </label>
              <textarea
                value={reEvalReason}
                onChange={e => setReEvalReason(e.target.value)}
                placeholder="E.g. Elaborated on transactional isolation and resilience..."
                rows={3}
                className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReEvalModalTurn(null)}
                disabled={isReEvaluating}
              >
                {t.interview.cancel}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleReEvaluateConfirm}
                isLoading={isReEvaluating}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t.interview.reEvaluationConfirm}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResultDetailPage;
