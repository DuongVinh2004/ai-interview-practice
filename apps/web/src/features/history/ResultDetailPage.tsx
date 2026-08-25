import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { formatScore } from '../../lib/utils';
import { useI18nStore } from '../../stores/i18n.store';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { RubricBreakdown } from '../../components/interview/RubricBreakdown';
import { ShareSessionModal } from '../../components/share/ShareSessionModal';
import { StarRadarChart } from '../../components/analytics/StarRadarChart';
import { StarAnnotationView } from '../../components/interview/StarAnnotationView';
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
} from 'lucide-react';

export function ResultDetailPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18nStore();

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isReEvaluating, setIsReEvaluating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reEvalModalTurn, setReEvalModalTurn] = useState<number | null>(null);
  const [reEvalReason, setReEvalReason] = useState('');

  // F006 Tutor & Retry State
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
    queryFn: () => apiClient(`/interviews/${sessionId}`),
    enabled: !!sessionId,
  });

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
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading interview result report...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back button & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/history')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to History</span>
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
            className="gap-1.5 text-indigo-700 hover:text-indigo-800 border-indigo-300 hover:bg-indigo-50"
          >
            <BookOpen className="h-4 w-4" />
            <span>Generate Flashcards</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsShareModalOpen(true)}
            className="gap-1.5 text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50"
          >
            <Share2 className="h-4 w-4" />
            <span>{t.share.shareTitle}</span>
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportJson} className="gap-1.5">
            <Download className="h-4 w-4" />
            <span>{t.share.exportJson}</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5 print:hidden"
          >
            <Printer className="h-4 w-4" />
            <span>{t.share.printPdf}</span>
          </Button>

          <Badge variant="success">Completed</Badge>
        </div>
      </div>

      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      {/* Header Score Overview */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-md">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
                Final Evaluation Report
              </span>
              <h1 className="text-2xl font-bold mt-1">
                {result.jobRole?.name} ({result.seniorityLevel?.name})
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                Tech Stack: {result.technologies?.map((t: any) => t.name).join(', ')}
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-800/80 p-4 rounded-xl border border-slate-700">
              <Award className="h-10 w-10 text-emerald-400" />
              <div>
                <span className="text-xs text-slate-400 block">Overall Score</span>
                <span className="text-3xl font-extrabold text-emerald-400 font-mono">
                  {formatScore(result.overallScore)}
                  <span className="text-sm text-slate-400 font-normal font-sans"> / 10</span>
                </span>
              </div>
            </div>
          </div>

          {/* Rubric Averages */}
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-700/60 text-center">
            <div>
              <span className="text-xs text-slate-400 block">{t.interview.technicalAccuracy}</span>
              <span className="text-lg font-bold text-white font-mono">
                {formatScore(result.rubricAverages?.technicalAccuracy)}/10
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">{t.interview.depth}</span>
              <span className="text-lg font-bold text-white font-mono">
                {formatScore(result.rubricAverages?.depth)}/10
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">{t.interview.clarity}</span>
              <span className="text-lg font-bold text-white font-mono">
                {formatScore(result.rubricAverages?.clarity)}/10
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

      {/* Learning Path */}
      <Card className="border-emerald-200 shadow-sm">
        <CardHeader className="bg-emerald-50/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-600" />
            <CardTitle>Personalized Learning Roadmap</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRegenerateLp}
            className="gap-1.5 text-xs text-slate-600"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Regenerate</span>
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {result.learningPath ? (
            <>
              {result.learningPath.summary && (
                <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 leading-relaxed">
                  {result.learningPath.summary}
                </p>
              )}

              <div className="space-y-3">
                {result.learningPath.items?.map((item: any, idx: number) => {
                  const isDone = item.isCompleted;
                  return (
                    <div
                      key={item.id || idx}
                      className={`p-4 rounded-xl border transition-all space-y-3 ${
                        isDone
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-white border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleItem(item.id, isDone)}
                            className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors"
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

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        {item.searchKeywords?.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Search className="h-3 w-3 text-slate-400" />
                            <span className="text-[10px] text-slate-400 font-medium">
                              Keywords:
                            </span>
                            {item.searchKeywords.map((kw: string, kidx: number) => (
                              <span
                                key={kidx}
                                className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigate(
                              `/interviews/new?mode=remediation&turns=3&topic=${encodeURIComponent(item.topic)}`,
                            )
                          }
                          className="gap-1 text-xs text-indigo-700 hover:text-indigo-800 border-indigo-200 hover:bg-indigo-50"
                        >
                          <Target className="h-3.5 w-3.5" />
                          <span>{t.practice.practiceSkill}</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Learning path is generating in the background...
            </p>
          )}
        </CardContent>
      </Card>

      {/* 5 Turns Review */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Questions & Answers Review</h3>
        {result.turns?.map((turn: any) => (
          <Card key={turn.turnNumber} className="overflow-hidden shadow-sm">
            <CardHeader className="bg-slate-50/70 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-700">
                  {t.interview.question} #{turn.turnNumber}
                </span>
                {turn.answer?.evaluation && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 font-mono">
                      Score: {formatScore(turn.answer.evaluation.score)}/10
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!sessionId) return;
                        await createTutorSession({
                          interviewId: sessionId,
                          turnNumber: turn.turnNumber,
                        });
                        setActiveTutorTurn({
                          turnNumber: turn.turnNumber,
                          questionContent: turn.question?.content || '',
                        });
                      }}
                      className="text-xs gap-1 text-indigo-700 hover:text-indigo-800 border-indigo-200"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      <span>Ask AI Tutor</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveRetryTurn({
                          turnNumber: turn.turnNumber,
                          questionContent: turn.question?.content || '',
                          originalAnswer: turn.answer?.content || '',
                          originalScore: turn.answer.evaluation.score,
                        });
                      }}
                      className="text-xs gap-1 text-sky-700 hover:text-sky-800 border-sky-200"
                    >
                      <RotateCw className="h-3 w-3" />
                      <span>Retry Question</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReEvalModalTurn(turn.turnNumber)}
                      isLoading={isReEvaluating}
                      className="text-xs gap-1 text-emerald-700 hover:text-emerald-800"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>{t.interview.requestReEvaluation}</span>
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Question
                </span>
                <p className="text-sm font-medium text-slate-900 whitespace-pre-wrap">
                  {turn.question?.content}
                </p>
              </div>

              {turn.answer && (
                <div className="text-xs text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 whitespace-pre-wrap">
                  <span className="font-bold text-slate-800 block mb-1">Your Answer:</span>
                  {turn.answer.content}
                </div>
              )}

              {turn.answer?.starEvaluation && (
                <div className="pt-2">
                  <StarAnnotationView
                    situationText={turn.answer.starEvaluation.situationText}
                    taskText={turn.answer.starEvaluation.taskText}
                    actionText={turn.answer.starEvaluation.actionText}
                    resultText={turn.answer.starEvaluation.resultText}
                  />
                </div>
              )}

              {turn.answer?.evaluation && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Rubric Breakdown
                  </span>
                  <RubricBreakdown scores={turn.answer.evaluation.rubricScores} />

                  <div className="p-3.5 bg-emerald-50/40 rounded-lg border border-emerald-100">
                    <span className="text-xs font-bold text-emerald-950 block mb-0.5">
                      Interviewer Feedback:
                    </span>
                    <p className="text-xs text-emerald-900 italic">
                      "{turn.answer.evaluation.conciseFeedback}"
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Re-evaluation Modal Dialog */}
      {reEvalModalTurn !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
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
                placeholder="E.g. Added details on horizontal scaling and cache invalidation..."
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

      {/* Share with Mentor Modal */}
      {sessionId && (
        <ShareSessionModal
          sessionId={sessionId}
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
          onSendMessage={sendTutorMessage}
          onRate={async rating => {
            if (tutorSession?.id) {
              await rateTutor({ sessionId: tutorSession.id, rating: { rating } });
            }
          }}
        />
      )}

      {/* Instant Question Retry Modal */}
      {activeRetryTurn && sessionId && (
        <InstantRetryModal
          isOpen={!!activeRetryTurn}
          onClose={() => {
            setActiveRetryTurn(null);
            refetch();
          }}
          interviewId={sessionId}
          turnNumber={activeRetryTurn.turnNumber}
          questionContent={activeRetryTurn.questionContent}
          originalAnswer={activeRetryTurn.originalAnswer}
          originalScore={activeRetryTurn.originalScore}
          onSubmitRetry={async retryAnswer => {
            const res = await submitQuestionRetry({
              interviewId: sessionId,
              turnNumber: activeRetryTurn.turnNumber,
              retryAnswer,
            });
            refetch();
            return res;
          }}
          isSubmitting={isSubmittingRetry}
        />
      )}
    </div>
  );
}
