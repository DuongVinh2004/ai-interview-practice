import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { InterviewSessionDto, SessionState } from '@ai-interview/contracts';
import { apiClient, ApiError } from '../../lib/api-client';
import { useInterviewSse } from '../../hooks/use-interview-sse';
import { formatDifficulty, formatScore } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';
import { Send, Award, CheckCircle2, HelpCircle, BarChart2, TrendingUp } from 'lucide-react';

export function InterviewRoomPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [answerText, setAnswerText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch session details
  const {
    data: session,
    isLoading,
    refetch,
  } = useQuery<InterviewSessionDto>({
    queryKey: ['interview', sessionId],
    queryFn: () => apiClient(`/interviews/${sessionId}`),
    enabled: !!sessionId,
    refetchInterval: false,
  });

  // Connect to SSE stream
  const { usingFallbackPolling } = useInterviewSse({
    sessionId,
    enabled: session?.state !== SessionState.COMPLETED && session?.state !== SessionState.CANCELLED,
    onSessionUpdated: () => {
      queryClient.invalidateQueries({ queryKey: ['interview', sessionId] });
    },
  });

  // Find active turn data
  const currentTurn = session?.turns.find(t => t.turnNumber === session.currentTurn);
  const question = currentTurn?.question;
  const answer = currentTurn?.answer;
  const evaluation = answer?.evaluation;

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !currentTurn || !answerText.trim() || isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const idempotencyKey = `sub-${sessionId}-turn-${currentTurn.turnNumber}-${Date.now()}`;
      await apiClient(`/interviews/${sessionId}/answers`, {
        method: 'POST',
        idempotencyKey,
        body: JSON.stringify({
          turnId: currentTurn.id,
          answerText: answerText.trim(),
        }),
      });

      setAnswerText('');
      await refetch();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to submit answer. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !session) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading interview room...</p>
      </div>
    );
  }

  const diffInfo = formatDifficulty(currentTurn?.difficulty || session.targetDifficulty);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Session Progress Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded">
              {session.jobRole.name} • {session.seniorityLevel.name}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${diffInfo.color}`}>
              {diffInfo.label} Difficulty
            </span>
            {usingFallbackPolling && (
              <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                Polling Mode
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Interview Question {session.currentTurn} of {session.totalTurns}
          </h1>
        </div>

        {/* 5-Turn Step Indicator */}
        <div className="flex items-center gap-2">
          {session.turns.map(turn => {
            const isCurrent = turn.turnNumber === session.currentTurn;
            const isCompleted = !!turn.answer?.evaluation;
            const isEvaluating =
              turn.turnNumber === session.currentTurn && session.state === SessionState.EVALUATING;

            return (
              <div
                key={turn.id}
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs transition-all ${
                  isCompleted
                    ? 'bg-emerald-600 text-white'
                    : isEvaluating
                      ? 'bg-amber-500 text-white animate-pulse'
                      : isCurrent
                        ? 'bg-slate-900 text-white ring-2 ring-emerald-500 ring-offset-1'
                        : 'bg-slate-100 text-slate-400'
                }`}
                title={`Turn ${turn.turnNumber}: ${turn.status}`}
              >
                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : turn.turnNumber}
              </div>
            );
          })}
        </div>
      </div>

      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      {/* State 1: CREATED - Waiting for Question Generation */}
      {session.state === SessionState.CREATED && !question && (
        <Card className="text-center py-16">
          <CardContent className="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <h3 className="text-lg font-bold text-slate-900">
              Generating Question {session.currentTurn}...
            </h3>
            <p className="text-sm text-slate-500 max-w-md">
              AI Orchestrator is tailoring question #{session.currentTurn} for your chosen tech
              stack ({session.technologies.map(t => t.name).join(', ')}).
            </p>
          </CardContent>
        </Card>
      )}

      {/* State 2: ACTIVE - Question Ready, Answer Pending */}
      {question && (
        <div className="space-y-6">
          {/* Question Card */}
          <Card className="border-l-4 border-l-emerald-600">
            <CardHeader className="bg-slate-50/50 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    {question.keyFocus || 'Core Technical Concept'}
                  </span>
                </div>
                <Badge variant="default">Turn {session.currentTurn}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-base text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">
                {question.content}
              </p>
            </CardContent>
          </Card>

          {/* Answer Form (When turn has not yet been submitted) */}
          {!answer && session.state === SessionState.ACTIVE && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Response</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitAnswer} className="space-y-4">
                  <Textarea
                    id="answer-textarea"
                    label="Type your detailed technical explanation"
                    placeholder="Structure your answer with key concepts, trade-offs, and practical examples..."
                    value={answerText}
                    onChange={e => setAnswerText(e.target.value)}
                    maxChars={5000}
                    currentChars={answerText.length}
                    rows={7}
                    required
                  />

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-slate-500">
                      Take your time. Once submitted, your answer is persisted and evaluated
                      asynchronously.
                    </p>
                    <Button
                      type="submit"
                      disabled={!answerText.trim() || answerText.length > 5000 || isSubmitting}
                      isLoading={isSubmitting}
                      className="gap-2 px-6"
                    >
                      <Send className="h-4 w-4" />
                      <span>Submit Answer</span>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Answer Submitted & Evaluating State */}
          {answer && session.state === SessionState.EVALUATING && !evaluation && (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Your Submitted Answer</CardTitle>
                  <Badge variant="warning">Evaluating</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-800 bg-white p-4 rounded-lg border border-slate-200 whitespace-pre-wrap">
                  {answer.content}
                </p>
                <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-amber-200">
                  <Spinner size="sm" />
                  <div className="text-xs text-amber-900">
                    <span className="font-semibold">
                      AI is evaluating your answer against the structured rubric...
                    </span>
                    <p className="text-slate-500 mt-0.5">
                      Scoring technical accuracy, depth, clarity, and extracting quoted evidence.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Answer Evaluated & Feedback Ready */}
          {answer && evaluation && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="bg-slate-50/50">
                  <CardTitle className="text-base">Your Answer</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-200">
                    {answer.content}
                  </p>
                </CardContent>
              </Card>

              {/* Evaluation Card */}
              <Card className="border-emerald-200 shadow-md">
                <CardHeader className="bg-emerald-50/60 border-b border-emerald-100 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-emerald-700" />
                    <CardTitle className="text-emerald-950">Evaluation & Feedback</CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1 rounded-full font-bold text-sm shadow-sm">
                    <span>{formatScore(evaluation.score)}</span>
                    <span className="text-emerald-200 text-xs">/ 10</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {/* Rubric Breakdown */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-xs text-slate-500 block">Technical Accuracy</span>
                      <span className="text-base font-bold text-slate-900">
                        {formatScore((evaluation.rubricScores as any)?.technicalAccuracy)}/10
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-xs text-slate-500 block">Depth & Detail</span>
                      <span className="text-base font-bold text-slate-900">
                        {formatScore((evaluation.rubricScores as any)?.depth)}/10
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-xs text-slate-500 block">Clarity & Structure</span>
                      <span className="text-base font-bold text-slate-900">
                        {formatScore((evaluation.rubricScores as any)?.clarity)}/10
                      </span>
                    </div>
                  </div>

                  {/* Concise Feedback */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Interviewer Summary
                    </h4>
                    <p className="text-sm text-slate-800">{evaluation.conciseFeedback}</p>
                  </div>

                  {/* Strengths & Improvements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200">
                      <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Key Strengths
                      </h4>
                      <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                        {(evaluation.strengths as string[]).map((str, idx) => (
                          <li key={idx}>{str}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-200">
                      <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-amber-600" />
                        Areas for Improvement
                      </h4>
                      <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                        {(evaluation.improvements as string[]).map((imp, idx) => (
                          <li key={idx}>{imp}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Evidence Quotes */}
                  {(evaluation.evidence as string[])?.length > 0 && (
                    <div className="text-xs text-slate-500 italic">
                      <span>Referenced from answer: </span>
                      {(evaluation.evidence as string[]).join(' ')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Completed Session State */}
      {session.state === SessionState.COMPLETED && (
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 text-center py-10">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="bg-emerald-600 text-white p-3 rounded-full shadow-lg">
              <Award className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">5-Turn Interview Completed!</h2>
            <p className="text-slate-600 text-sm max-w-md">
              Congratulations on completing the mock interview. Your overall performance score is{' '}
              <span className="font-bold text-emerald-700 text-base">
                {formatScore(session.overallScore)} / 10
              </span>
              .
            </p>
            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => navigate(`/interviews/${session.id}/result`)}
                className="gap-2"
              >
                <BarChart2 className="h-4 w-4" />
                <span>View Full Result & Learning Path</span>
              </Button>
              <Button variant="outline" onClick={() => navigate('/interviews/new')}>
                Start Another Practice
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
