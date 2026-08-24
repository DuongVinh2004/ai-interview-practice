import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { InterviewSessionDto, SessionState, InterviewMode, SessionMode } from '@ai-interview/contracts';
import { apiClient, ApiError } from '../../lib/api-client';
import { useInterviewSse } from '../../hooks/use-interview-sse';
import { useAudioSettingsStore } from '../../stores/audio-settings.store';
import { useSpeechSynthesizer } from '../../hooks/use-speech-synthesizer';
import { formatDifficulty, formatScore } from '../../lib/utils';
import { useI18nStore } from '../../stores/i18n.store';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';
import { PacingTimer } from '../../components/interview/PacingTimer';
import { RubricBreakdown } from '../../components/interview/RubricBreakdown';
import { TurnHistoryAccordion } from '../../components/interview/TurnHistoryAccordion';
import { VoiceModeControls } from '../../components/audio/VoiceModeControls';
import { AudioAnswerRecorder } from '../../components/audio/AudioAnswerRecorder';
import { AudioVisualizer } from '../../components/audio/AudioVisualizer';
import { MonacoCodeEditor } from '../../components/code-editor/MonacoCodeEditor';
import { ConsoleOutput } from '../../components/code-editor/ConsoleOutput';
import { TestCasePanel } from '../../components/code-editor/TestCasePanel';
import { AiCodeReviewPanel } from '../../components/code-editor/AiCodeReviewPanel';
import { StarGuidePanel } from '../../components/interview/StarGuidePanel';
import { VoiceInterviewRoom } from '../../components/interview/VoiceInterviewRoom';
import { WhiteboardRoom } from '../system-design/WhiteboardRoom';
import { useCodeExecution } from '../../hooks/useCodeExecution';
import { SupportedCodeLanguage } from '@ai-interview/contracts';
import {
  Send,
  Award,
  CheckCircle2,
  HelpCircle,
  BarChart2,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Volume2,
  Code2,
} from 'lucide-react';

export function InterviewRoomPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18nStore();

  const [answerText, setAnswerText] = useState('');
  const [codeLanguage, setCodeLanguage] = useState<SupportedCodeLanguage>('javascript');
  const [sourceCode, setSourceCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReEvaluating, setIsReEvaluating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reEvalModalTurn, setReEvalModalTurn] = useState<number | null>(null);
  const [reEvalReason, setReEvalReason] = useState('');

  const {
    executeCode,
    isExecuting,
    executionResult,
    submitCode,
    submissionResult,
  } = useCodeExecution(sessionId || '');

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

  const { mode, autoPlayTts } = useAudioSettingsStore();

  const {
    isSpeaking: isAiSpeaking,
    isLoading: isAiTtsLoading,
    speak: speakAiQuestion,
    pause: pauseAiSpeech,
    replay: replayAiSpeech,
    stop: stopAiSpeech,
    getAnalyserData: getAiAnalyserData,
  } = useSpeechSynthesizer();

  const lastSpokenQuestionRef = useRef<string | null>(null);

  // Auto-speak AI question when a new turn starts in Voice Mode
  useEffect(() => {
    if (
      mode === InterviewMode.VOICE &&
      autoPlayTts &&
      question?.content &&
      session?.state === SessionState.ACTIVE &&
      !answer &&
      lastSpokenQuestionRef.current !== question.content
    ) {
      lastSpokenQuestionRef.current = question.content;
      speakAiQuestion(question.content);
    }
  }, [mode, autoPlayTts, question?.content, session?.state, answer, speakAiQuestion]);

  const handleSubmitAnswerText = async (textToSubmit: string) => {
    if (!sessionId || !currentTurn || !textToSubmit.trim() || isSubmitting) return;

    stopAiSpeech();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const idempotencyKey = `sub-${sessionId}-turn-${currentTurn.turnNumber}-${Date.now()}`;
      await apiClient(`/interviews/${sessionId}/answers`, {
        method: 'POST',
        idempotencyKey,
        body: JSON.stringify({
          turnId: currentTurn.id,
          answerText: textToSubmit.trim(),
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

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmitAnswerText(answerText);
  };

  const handleRunCode = async (code: string, language: SupportedCodeLanguage) => {
    if (!sessionId) return;
    try {
      setErrorMessage(null);
      await executeCode({
        language,
        sourceCode: code,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to execute code in sandbox.');
    }
  };

  const handleSubmitCodingSolution = async (code: string, language: SupportedCodeLanguage) => {
    if (!sessionId || !currentTurn) return;
    try {
      setErrorMessage(null);
      await submitCode({
        turnNumber: currentTurn.turnNumber,
        language,
        sourceCode: code,
      });
      // Also submit text explanation containing the source code for evaluation pipeline
      await handleSubmitAnswerText(`[${language.toUpperCase()} Solution]\n\`\`\`${language}\n${code}\n\`\`\``);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit code solution.');
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
      queryClient.invalidateQueries({ queryKey: ['interview', sessionId] });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to re-evaluate answer.');
    } finally {
      setIsReEvaluating(false);
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

  if (session.sessionMode === SessionMode.VOICE_LIVE || (session.sessionMode as any) === 'VOICE_LIVE') {
    return (
      <VoiceInterviewRoom
        interviewId={session.id}
        roleName={session.jobRole?.name}
        levelName={session.seniorityLevel?.name}
        onFinish={() => navigate(`/interviews/${session.id}/result`)}
      />
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
            {session.isSandbox && (
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
                {t.practice.sandboxBadge}
              </span>
            )}
            {session.sessionMode === 'FOCUSED_REMEDIATION' && (
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                {t.practice.remediation}
              </span>
            )}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${diffInfo.color}`}>
              {diffInfo.label} {t.interview.difficulty}
            </span>
            {usingFallbackPolling && (
              <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                {t.interview.pollingMode}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {t.interview.question} {session.currentTurn} {t.interview.of} {session.totalTurns}
          </h1>
        </div>

        {/* 5-Turn Step Indicator & Pacing Timer */}
        <div className="flex items-center gap-3">
          <PacingTimer
            isActive={session.state === SessionState.ACTIVE && !answer}
            turnNumber={session.currentTurn}
          />

          <div className="flex items-center gap-1.5">
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
      </div>

      {/* Voice Mode Controls Toolbar */}
      <VoiceModeControls
        isAiSpeaking={isAiSpeaking}
        isAiLoading={isAiTtsLoading}
        onPlayAiSpeech={() => question && speakAiQuestion(question.content)}
        onPauseAiSpeech={pauseAiSpeech}
        onReplayAiSpeech={replayAiSpeech}
      />

      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      {/* State 1: CREATED - Waiting for Question Generation */}
      {session.state === SessionState.CREATED && !question && (
        <Card className="text-center py-16">
          <CardContent className="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <h3 className="text-lg font-bold text-slate-900">
              {t.interview.generatingQuestion}
            </h3>
            <p className="text-sm text-slate-500 max-w-md">
              {t.interview.generatingHint} ({session.technologies.map(t => t.name).join(', ')}).
            </p>
          </CardContent>
        </Card>
      )}

      {/* State 2: ACTIVE - Question Ready, Answer Pending */}
      {question && (
        <div className="space-y-6">
          {session.sessionMode === 'BEHAVIORAL' && <StarGuidePanel />}

          {/* Question Card */}
          <Card className="border-l-4 border-l-emerald-600 shadow-sm">
            <CardHeader className="bg-slate-50/50 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    {question.keyFocus || t.interview.coreConcept}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {currentTurn?.isFollowUp && (
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      {t.practice.followUpBadge}
                    </span>
                  )}
                  {isAiSpeaking && (
                    <span className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full font-semibold border border-indigo-200 animate-pulse">
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>{t.audio?.aiSpeaking || 'Speaking...'}</span>
                    </span>
                  )}
                  <Badge variant="default">
                    {t.interview.question} {session.currentTurn}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-base text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">
                {question.content}
              </p>

              {/* Real-time AI Speech Waveform when AI is speaking */}
              {isAiSpeaking && (
                <div className="pt-2 border-t border-slate-100">
                  <AudioVisualizer
                    isActive={isAiSpeaking}
                    getAnalyserData={getAiAnalyserData}
                    mode="bars"
                    theme="ai"
                    height={40}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Candidate Response Section */}
          {!answer && session.state === SessionState.ACTIVE && (
            <div>
              {session.sessionMode === 'SYSTEM_DESIGN' || (session.sessionMode as any) === SessionMode.SYSTEM_DESIGN ? (
                <div className="space-y-4" data-testid="system-design-workspace">
                  <WhiteboardRoom
                    interviewId={session.id}
                    onCompleteSession={() => handleSubmitAnswerText('[Whiteboard System Design Diagram Submitted]')}
                  />
                </div>
              ) : session.sessionMode === 'CODING' ? (
                /* Live Coding Mode: Split-Pane Monaco Code Editor & Sandbox Console */
                <div className="space-y-4" data-testid="live-coding-workspace">
                  <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-100 p-2 rounded-lg border border-slate-200">
                    <Code2 className="w-4 h-4 text-primary-600" />
                    <span className="font-semibold text-slate-700">Live Coding Sandbox:</span>
                    <span>Write code, run test cases against the execution engine, and submit for AI complexity review.</span>
                  </div>

                  <div className="h-[420px]">
                    <MonacoCodeEditor
                      language={codeLanguage}
                      initialCode={sourceCode}
                      onLanguageChange={lang => setCodeLanguage(lang)}
                      onCodeChange={code => setSourceCode(code)}
                      onRunCode={(code, lang) => handleRunCode(code, lang)}
                      onSubmitCode={(code, lang) => handleSubmitCodingSolution(code, lang)}
                      isRunning={isExecuting}
                      isSubmitting={isSubmitting}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TestCasePanel testResults={executionResult?.testResults} />
                    <ConsoleOutput result={executionResult} isLoading={isExecuting} />
                  </div>

                  {submissionResult?.aiReview && (
                    <AiCodeReviewPanel review={submissionResult.aiReview} />
                  )}
                </div>
              ) : mode === InterviewMode.VOICE ? (
                /* Voice Mode: Microphone Recorder & Audio Visualizer */
                <AudioAnswerRecorder
                  onAnswerReady={handleSubmitAnswerText}
                  isSubmitting={isSubmitting}
                  sessionId={sessionId}
                />
              ) : (
                /* Text Mode: Standard Textarea Response Form */
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t.interview.yourResponse}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmitAnswer} className="space-y-4">
                      <Textarea
                        id="answer-textarea"
                        label={t.interview.typeExplanation}
                        placeholder={t.interview.placeholder}
                        value={answerText}
                        onChange={e => setAnswerText(e.target.value)}
                        maxChars={5000}
                        currentChars={answerText.length}
                        rows={7}
                        required
                      />

                      <div className="flex items-center justify-between pt-2">
                        <p className="text-xs text-slate-500">
                          {t.interview.submitNotice}
                        </p>
                        <Button
                          type="submit"
                          disabled={!answerText.trim() || answerText.length > 5000 || isSubmitting}
                          isLoading={isSubmitting}
                          className="gap-2 px-6"
                        >
                          <Send className="h-4 w-4" />
                          <span>{isSubmitting ? t.interview.submitting : t.interview.submitAnswer}</span>
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Answer Submitted & Evaluating State */}
          {answer && session.state === SessionState.EVALUATING && !evaluation && (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t.interview.submittedAnswer}</CardTitle>
                  <Badge variant="warning">{t.interview.evaluatingTitle}</Badge>
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
                      {t.interview.evaluatingDesc}
                    </span>
                    <p className="text-slate-500 mt-0.5">
                      {t.interview.evaluatingDetail}
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
                  <CardTitle className="text-base">{t.interview.submittedAnswer}</CardTitle>
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
                    <CardTitle className="text-emerald-950">{t.interview.feedbackTitle}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1 rounded-full font-bold text-sm shadow-sm">
                    <span>{formatScore(evaluation.score)}</span>
                    <span className="text-emerald-200 text-xs">/ 10</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {/* Visual Rubric Breakdown Bars */}
                  <RubricBreakdown scores={evaluation.rubricScores as any} />

                  {/* Concise Feedback */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                      {t.interview.interviewerSummary}
                    </h4>
                    <p className="text-sm text-slate-800">{evaluation.conciseFeedback}</p>
                  </div>

                  {/* Strengths & Improvements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200">
                      <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {t.interview.keyStrengths}
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
                        {t.interview.areasForImprovement}
                      </h4>
                      <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                        {(evaluation.improvements as string[]).map((imp, idx) => (
                          <li key={idx}>{imp}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Evidence Quotes & Missing Concepts */}
                  <div className="space-y-3 pt-2">
                    {/* Confidence & Review Indicator */}
                    <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-700">{t.interview.confidence}:</span>
                        <span className="font-semibold text-emerald-700">
                          {Math.round(((evaluation as any).confidence || 0.85) * 100)}%
                        </span>
                      </div>
                      {(evaluation as any).needsReview && (
                        <Badge variant="warning" className="text-[10px] px-2 py-0.5">
                          {t.interview.needsReview}
                        </Badge>
                      )}
                    </div>

                    {/* Missing Concepts (if any) */}
                    {(evaluation as any).missingConcepts?.length > 0 && (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                          {t.interview.studyConcepts}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {((evaluation as any).missingConcepts as string[]).map((concept, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-md font-medium"
                            >
                              • {concept}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Referenced Evidence Spans */}
                    {(evaluation.evidence as string[])?.length > 0 && (
                      <div className="p-3 bg-emerald-50/40 rounded-lg border border-emerald-100">
                        <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block mb-1.5">
                          {t.interview.quotedEvidence}
                        </span>
                        <ul className="text-xs text-emerald-800 space-y-1 italic">
                          {(evaluation.evidence as string[]).map((ev, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-emerald-500 font-bold not-italic">“</span>
                              <span>{ev.replace(/^["“”]|["“”]$/g, '')}</span>
                              <span className="text-emerald-500 font-bold not-italic">”</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Re-evaluation Request Button */}
                    <div className="flex justify-end pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReEvalModalTurn(currentTurn.turnNumber)}
                        isLoading={isReEvaluating}
                        className="gap-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>{t.interview.requestReEvaluation}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Collapsible Past Turns Accordion */}
          <TurnHistoryAccordion
            turns={session.turns}
            currentTurnNumber={session.currentTurn}
            onReEvaluate={turnNum => setReEvalModalTurn(turnNum)}
            isReEvaluating={isReEvaluating}
          />
        </div>
      )}

      {/* Completed Session State */}
      {session.state === SessionState.COMPLETED && (
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 text-center py-10 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="bg-emerald-600 text-white p-3 rounded-full shadow-lg">
              <Award className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{t.interview.completedTitle}</h2>
            <p className="text-slate-600 text-sm max-w-md">
              {t.interview.completedDesc}{' '}
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
                <span>{t.interview.viewFullResult}</span>
              </Button>
              <Button variant="outline" onClick={() => navigate('/interviews/new')}>
                {t.interview.startAnother}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Re-evaluation Modal / Confirmation Dialog */}
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
