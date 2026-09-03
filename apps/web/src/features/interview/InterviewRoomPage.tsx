import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  InterviewSessionDto,
  SessionState,
  InterviewMode,
  SessionMode,
  SupportedCodeLanguage,
} from '@ai-interview/contracts';
import { apiClient, ApiError } from '../../lib/api-client';
import { useInterviewSse } from '../../hooks/use-interview-sse';
import { useAudioSettingsStore } from '../../stores/audio-settings.store';
import { useSpeechSynthesizer } from '../../hooks/use-speech-synthesizer';
import { formatDifficulty, formatScore } from '../../lib/utils';
import { useI18nStore } from '../../stores/i18n.store';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { Modal } from '../../components/ui/Modal';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { ProgressBar } from '../../components/ui/ProgressBar';
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
import { GreenRoomModal } from './GreenRoomModal';
import { WhiteboardRoom } from '../system-design/WhiteboardRoom';
import { useCodeExecution } from '../../hooks/useCodeExecution';
import { useFocusModeStore } from '../../stores/focus-mode.store';
import { useGamificationStore } from '../../stores/gamification.store';
import { playSFX } from '../../lib/sfx-engine';
import {
  Send,
  Award,
  CheckCircle2,
  HelpCircle,
  BarChart2,
  TrendingUp,
  RotateCcw,
  AlertCircle,
  Volume2,
  Code2,
  Wifi,
  WifiOff,
  RefreshCw,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react';

export function InterviewRoomPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, language } = useI18nStore();
  const { isFocusMode, toggleFocusMode } = useFocusModeStore();
  const { addXpLocally } = useGamificationStore();
  const hasCelebratedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [answerText, setAnswerText] = useState('');
  const [codeLanguage, setCodeLanguage] = useState<SupportedCodeLanguage>('javascript');
  const [sourceCode, setSourceCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReEvaluating, setIsReEvaluating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reEvalModalTurn, setReEvalModalTurn] = useState<number | null>(null);
  const [reEvalReason, setReEvalReason] = useState('');
  const [isGreenRoomOpen, setIsGreenRoomOpen] = useState(false);

  const { executeCode, isExecuting, executionResult, submitCode, submissionResult } =
    useCodeExecution(sessionId || '');

  // Fetch session details
  const {
    data: session,
    isLoading,
    isError,
    error: queryError,
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

  // Safe localStorage helper
  const getDraft = (key: string): string | null => {
    try {
      return typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(key)
        : null;
    } catch {
      return null;
    }
  };

  const authUser = useAuthStore(state => state.user);
  const userId = authUser?.id || 'anonymous';

  const setDraft = (key: string, value: string) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore storage write errors in test or private browsing
    }
  };

  const removeDraft = (key: string) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage remove errors in test or private browsing
    }
  };

  // Restore cached draft from localStorage if available
  useEffect(() => {
    if (sessionId && currentTurn && !answer) {
      const draftKey = `draft-answer-${userId}-${sessionId}-turn-${currentTurn.turnNumber}`;
      const savedDraft = getDraft(draftKey);
      if (savedDraft && !answerText) {
        setAnswerText(savedDraft);
      }
    }
  }, [sessionId, currentTurn, answer, userId]);

  // Persist draft to localStorage on change
  const handleDraftChange = useCallback(
    (text: string) => {
      setAnswerText(text);
      if (sessionId && currentTurn) {
        const draftKey = `draft-answer-${userId}-${sessionId}-turn-${currentTurn.turnNumber}`;
        if (text.trim()) {
          setDraft(draftKey, text);
        } else {
          removeDraft(draftKey);
        }
      }
    },
    [sessionId, currentTurn, userId],
  );

  // Open Green Room if explicitly flagged in sessionStorage
  useEffect(() => {
    if (sessionId && session?.state === SessionState.ACTIVE && !currentTurn?.answer) {
      try {
        if (sessionStorage.getItem(`open-greenroom-${sessionId}`) === 'true') {
          setIsGreenRoomOpen(true);
        }
      } catch {
        // ignore storage errors
      }
    }
  }, [sessionId, session?.state, currentTurn?.answer]);

  // Warn before unload if user has unsaved draft text
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (answerText.trim() && !answer && !isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [answerText, answer, isSubmitting]);

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

      // Clear draft from storage on successful submission
      const draftKey = `draft-answer-${userId}-${sessionId}-turn-${currentTurn.turnNumber}`;
      removeDraft(draftKey);
      if (isMountedRef.current) {
        setAnswerText('');
      }
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['interview', sessionId] });
    } catch (err: any) {
      if (!isMountedRef.current) return;
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          language === 'vi'
            ? 'Không thể gửi câu trả lời. Vui lòng kiểm tra kết nối và thử lại.'
            : 'Failed to submit answer. Please check your network and try again.',
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
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
      await handleSubmitAnswerText(
        `[${language.toUpperCase()} Solution]\n\`\`\`${language}\n${code}\n\`\`\``,
      );
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

  // Keyboard shortcuts and Focus Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus mode toggle: F11 or Ctrl+Shift+F / Cmd+Shift+F
      if (
        e.key === 'F11' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f'))
      ) {
        e.preventDefault();
        toggleFocusMode();
        return;
      }

      // Quick Submit: Ctrl+Enter or Cmd+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (session?.state === SessionState.ACTIVE && !answer && !isSubmitting) {
          if (session.sessionMode === SessionMode.CODING) {
            if (sourceCode.trim()) {
              e.preventDefault();
              handleSubmitCodingSolution(sourceCode, codeLanguage);
            }
          } else {
            if (answerText.trim()) {
              e.preventDefault();
              handleSubmitAnswerText(answerText);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    session?.state,
    session?.sessionMode,
    answer,
    isSubmitting,
    answerText,
    sourceCode,
    codeLanguage,
    toggleFocusMode,
    handleSubmitCodingSolution,
    handleSubmitAnswerText,
  ]);

  // Completion celebration
  useEffect(() => {
    if (session?.state === SessionState.COMPLETED && !hasCelebratedRef.current) {
      hasCelebratedRef.current = true;
      playSFX('success');
      addXpLocally(150, language === 'vi' ? 'Hoàn thành buổi phỏng vấn' : 'Interview Completed');
    }
  }, [session?.state, language, addXpLocally]);

  // 1. Loading Skeleton View
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <Skeleton variant="card" height={90} />
        <Skeleton variant="card" height={180} />
        <Skeleton variant="card" height={240} />
      </div>
    );
  }

  // 2. Error / Session Unavailable View
  if (isError || !session) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <ErrorState
          title={
            language === 'vi' ? 'Không Thể Tải Phiên Phỏng Vấn' : 'Unable to Load Interview Session'
          }
          message={
            (queryError as any)?.message ||
            (language === 'vi'
              ? 'Phiên phỏng vấn không tồn tại hoặc đã bị hủy. Vui lòng quay lại danh sách hoặc thử lại.'
              : 'The requested interview session could not be found or was cancelled.')
          }
          onRetry={() => refetch()}
          retryLabel={language === 'vi' ? 'Tải lại' : 'Reload Session'}
        />
        <div className="text-center mt-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
            {language === 'vi' ? 'Quay lại Lịch sử' : 'Back to History'}
          </Button>
        </div>
      </div>
    );
  }

  // 3. Voice Live Room
  if (
    session.sessionMode === SessionMode.VOICE_LIVE ||
    (session.sessionMode as any) === 'VOICE_LIVE'
  ) {
    return (
      <VoiceInterviewRoom
        interviewId={session.id}
        roleName={session.jobRole?.name}
        levelName={session.seniorityLevel?.name}
        onRestAnswerSubmit={async (text: string) => {
          if (currentTurn?.id) {
            await handleSubmitAnswerText(text);
          }
        }}
        onFinish={() => {
          if (session.state === SessionState.COMPLETED) {
            navigate(`/interviews/${session.id}/result`);
          } else {
            refetch();
          }
        }}
      />
    );
  }

  const diffInfo = formatDifficulty(currentTurn?.difficulty || session.targetDifficulty);
  const totalTurnsCount = session.totalTurns || 5;
  const currentTurnNumber = session.currentTurn || 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Live Region for Screen Readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {session.state === SessionState.EVALUATING
          ? 'AI is evaluating your answer against the rubric.'
          : evaluation
            ? `Turn ${currentTurnNumber} evaluation complete. Score: ${formatScore(evaluation.score)} out of 10.`
            : `Question ${currentTurnNumber} of ${totalTurnsCount} ready.`}
      </div>

      {/* Session Progress Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                {session.jobRole.name} • {session.seniorityLevel.name}
              </span>

              {session.isSandbox && (
                <Badge variant="warning" className="text-[10px]">
                  {t.practice.sandboxBadge}
                </Badge>
              )}

              {session.sessionMode === 'FOCUSED_REMEDIATION' && (
                <Badge variant="indigo" className="text-[10px]">
                  {t.practice.remediation}
                </Badge>
              )}

              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded border ${diffInfo.color}`}
              >
                {diffInfo.label} {t.interview.difficulty}
              </span>

              {usingFallbackPolling ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200"
                  title="Live SSE stream disconnected; automatically syncing via backup polling"
                >
                  <WifiOff className="h-3 w-3 text-amber-600" />
                  <span>{t.interview.pollingMode}</span>
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200"
                  title="Real-time SSE event stream connected"
                >
                  <Wifi className="h-3 w-3 text-emerald-600" />
                  <span>{language === 'vi' ? 'Trực tiếp (SSE)' : 'Live Stream'}</span>
                </span>
              )}
            </div>

            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              {t.interview.question} {currentTurnNumber} {t.interview.of} {totalTurnsCount}
            </h1>
          </div>

          {/* Turn Timer & Quick Actions */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            <PacingTimer
              isActive={session.state === SessionState.ACTIVE && !answer}
              turnNumber={currentTurnNumber}
            />

            {/* Green Room Device Check Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsGreenRoomOpen(true)}
              title={
                language === 'vi'
                  ? 'Mở Phòng chuẩn bị thiết bị (Green Room)'
                  : 'Open Pre-Interview Green Room'
              }
              className="gap-1.5 text-xs text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">Green Room</span>
            </Button>

            {/* Focus / Zen Mode Toggle */}
            <Button
              variant={isFocusMode ? 'primary' : 'ghost'}
              size="sm"
              onClick={toggleFocusMode}
              title={
                language === 'vi'
                  ? 'Bật/Tắt Chế độ tập trung Zen Mode (F11 / Ctrl+Shift+F)'
                  : 'Toggle Zen Focus Mode (F11 / Ctrl+Shift+F)'
              }
              className={`p-2 transition-colors ${
                isFocusMode ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              {isFocusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              title="Manual sync / Làm mới trạng thái"
              className="p-2 text-slate-400 hover:text-slate-700"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Accessible Progress Bar */}
        <ProgressBar value={currentTurnNumber} max={totalTurnsCount} variant="emerald" size="sm" />
      </div>

      {/* Voice Mode Controls Toolbar */}
      <VoiceModeControls
        isAiSpeaking={isAiSpeaking}
        isAiLoading={isAiTtsLoading}
        onPlayAiSpeech={() => question && speakAiQuestion(question.content)}
        onPauseAiSpeech={pauseAiSpeech}
        onReplayAiSpeech={replayAiSpeech}
      />

      {errorMessage && (
        <Alert variant="error" className="animate-fade-in">
          {errorMessage}
        </Alert>
      )}
      {successMessage && (
        <Alert variant="success" className="animate-fade-in">
          {successMessage}
        </Alert>
      )}

      {/* STATE 0: Terminal Failure / Cancelled */}
      {(session.state === SessionState.FAILED || session.state === SessionState.CANCELLED) && (
        <Card className="text-center py-12 border-rose-200 bg-rose-50/30">
          <CardContent className="flex flex-col items-center gap-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {session.state === SessionState.CANCELLED
                ? language === 'vi'
                  ? 'Phiên phỏng vấn đã kết thúc/hủy'
                  : 'Interview Session Cancelled'
                : language === 'vi'
                  ? 'Khởi tạo phỏng vấn không thành công'
                  : 'Interview Generation Failed'}
            </h3>
            <p className="text-xs text-slate-600">
              {session.state === SessionState.CANCELLED
                ? language === 'vi'
                  ? 'Phiên phỏng vấn này đã bị hủy bỏ.'
                  : 'This interview session has been cancelled.'
                : language === 'vi'
                  ? 'Đã xảy ra sự cố trong quá trình khởi tạo câu hỏi. Vui lòng thử tạo phiên mới hoặc quay lại lịch sử.'
                  : 'Failed to generate interview questions. Please start a new session or return to history.'}
            </p>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
                {language === 'vi' ? 'Về Lịch sử' : 'Back to History'}
              </Button>
              <Button variant="primary" size="sm" onClick={() => navigate('/setup')}>
                {language === 'vi' ? 'Tạo phiên mới' : 'New Interview'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STATE 1: Question Generating / Waiting for Turn */}
      {!question &&
        session.state !== SessionState.COMPLETED &&
        session.state !== SessionState.FAILED &&
        session.state !== SessionState.CANCELLED && (
          <Card className="text-center py-16 border-slate-200">
            <CardContent className="flex flex-col items-center gap-4">
              <Spinner size="lg" />
              <h3 className="text-lg font-bold text-slate-900">{t.interview.generatingQuestion}</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md leading-relaxed">
                {t.interview.generatingHint} ({session.technologies.map(t => t.name).join(', ')}).
              </p>
            </CardContent>
          </Card>
        )}

      {/* STATE 2: Question Ready & Answer Drafting / Evaluating */}
      {session.state !== SessionState.COMPLETED && question && (
        <div className="space-y-6">
          {session.sessionMode === 'BEHAVIORAL' && <StarGuidePanel />}

          {/* Question Card */}
          <Card className="border-l-4 border-l-emerald-600 shadow-sm">
            <CardHeader className="bg-slate-50/70 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
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
                  <Badge variant="default" className="text-xs">
                    {t.interview.question} {currentTurnNumber}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-sm sm:text-base text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">
                {question.content}
              </p>

              {/* Waveform visualizer when AI is reading out question */}
              {isAiSpeaking && (
                <div className="pt-2 border-t border-slate-100">
                  <AudioVisualizer
                    isActive={isAiSpeaking}
                    getAnalyserData={getAiAnalyserData}
                    mode="bars"
                    theme="ai"
                    height={36}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Candidate Response Editor Area */}
          {!answer && (
            <div>
              {session.sessionMode === 'SYSTEM_DESIGN' ||
              (session.sessionMode as any) === SessionMode.SYSTEM_DESIGN ? (
                <div className="space-y-4" data-testid="system-design-workspace">
                  <WhiteboardRoom
                    interviewId={session.id}
                    onCompleteSession={() =>
                      handleSubmitAnswerText('[Whiteboard System Design Diagram Submitted]')
                    }
                  />
                </div>
              ) : session.sessionMode === 'CODING' ? (
                /* Live Coding Sandbox */
                <div className="space-y-4" data-testid="live-coding-workspace">
                  <div className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <Code2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-slate-800">Live Coding Sandbox:</span>
                    <span>
                      Write code, run test cases against the engine, and submit for AI complexity
                      review.
                    </span>
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
                /* Voice Mode Recording */
                <AudioAnswerRecorder
                  onAnswerReady={handleSubmitAnswerText}
                  isSubmitting={isSubmitting}
                  sessionId={sessionId}
                />
              ) : (
                /* Standard Textarea Form */
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm sm:text-base">
                      {t.interview.yourResponse}
                    </CardTitle>
                    <CardDescription>
                      {language === 'vi'
                        ? 'Trình bày câu trả lời kỹ thuật chi tiết kèm các đánh đổi (trade-offs) thực tế'
                        : 'Structure your explanation with technical trade-offs, architecture context, and practical rationale'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmitAnswer} className="space-y-4">
                      <Textarea
                        id="answer-textarea"
                        label={t.interview.typeExplanation}
                        placeholder={t.interview.placeholder}
                        value={answerText}
                        onChange={e => handleDraftChange(e.target.value)}
                        maxChars={5000}
                        currentChars={answerText.length}
                        rows={7}
                        disabled={isSubmitting}
                        required
                      />

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
                        <p className="text-[11px] text-slate-500 text-center sm:text-left">
                          {t.interview.submitNotice}
                        </p>
                        <Button
                          type="submit"
                          disabled={!answerText.trim() || answerText.length > 5000 || isSubmitting}
                          isLoading={isSubmitting}
                          leftIcon={<Send className="h-4 w-4" />}
                          className="w-full sm:w-auto px-6 font-bold shadow-sm"
                        >
                          <span>
                            {isSubmitting ? t.interview.submitting : t.interview.submitAnswer}
                          </span>
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* STATE 3: Evaluating in Progress */}
          {answer && !evaluation && (
            <Card className="border-amber-200 bg-amber-50/40 shadow-sm animate-pulse-subtle">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-900">
                    {t.interview.submittedAnswer}
                  </CardTitle>
                  <Badge variant="warning">{t.interview.evaluatingTitle}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs sm:text-sm text-slate-800 bg-white p-4 rounded-xl border border-slate-200 whitespace-pre-wrap">
                  {answer.content}
                </p>
                <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-amber-200 shadow-xs">
                  <Spinner size="sm" />
                  <div className="text-xs text-amber-950">
                    <span className="font-bold">{t.interview.evaluatingDesc}</span>
                    <p className="text-slate-500 mt-0.5">{t.interview.evaluatingDetail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STATE 4: Turn Evaluation Feedback Ready */}
          {answer && evaluation && (
            <div className="space-y-6 animate-slide-up">
              <Card className="border-slate-200">
                <CardHeader className="bg-slate-50/60 pb-2">
                  <CardTitle className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    {t.interview.submittedAnswer}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    {answer.content}
                  </p>
                </CardContent>
              </Card>

              {/* Evaluation Report Card */}
              <Card className="border-emerald-200 shadow-md overflow-hidden">
                <CardHeader className="bg-emerald-50/70 border-b border-emerald-100 flex flex-row items-center justify-between p-5 sm:p-6">
                  <div className="flex items-center gap-2.5">
                    <Award className="h-5 w-5 text-emerald-700" />
                    <div>
                      <CardTitle className="text-sm sm:text-base text-emerald-950 font-bold">
                        {t.interview.feedbackTitle}
                      </CardTitle>
                      <span className="text-[11px] text-emerald-800">
                        {language === 'vi'
                          ? 'Đánh giá chi tiết theo chuẩn Rubric 3 chiều'
                          : 'Deterministic 3-dimensional rubric scoring'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1 rounded-full font-bold text-sm shadow-xs font-mono">
                    <span>{formatScore(evaluation.score)}</span>
                    <span className="text-emerald-200 text-xs">/ 10</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {/* Rubric Breakdown Bars */}
                  <RubricBreakdown scores={evaluation.rubricScores as any} />

                  {/* Concise Feedback Summary */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                      {t.interview.interviewerSummary}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                      {evaluation.conciseFeedback}
                    </p>
                  </div>

                  {/* Strengths & Improvements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                      <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {t.interview.keyStrengths}
                      </h4>
                      <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                        {(evaluation.strengths as string[]).map((str, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {str}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200">
                      <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-amber-600" />
                        {t.interview.areasForImprovement}
                      </h4>
                      <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                        {(evaluation.improvements as string[]).map((imp, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {imp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Evidence Quotes & Missing Concepts */}
                  <div className="space-y-3 pt-2">
                    {/* Confidence & Review Indicator */}
                    <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-700">
                          {t.interview.confidence}:
                        </span>
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

                    {/* Missing Concepts */}
                    {(evaluation as any).missingConcepts?.length > 0 && (
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
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
                      <div className="p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-100">
                        <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block mb-1.5">
                          {t.interview.quotedEvidence}
                        </span>
                        <ul className="text-xs text-emerald-800 space-y-1.5 italic">
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

                    {/* Re-evaluation Request */}
                    <div className="flex justify-end pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReEvalModalTurn(currentTurn.turnNumber)}
                        isLoading={isReEvaluating}
                        leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                        className="text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                      >
                        <span>{t.interview.requestReEvaluation}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Past Turns History Accordion */}
          <TurnHistoryAccordion
            turns={session.turns}
            currentTurnNumber={currentTurnNumber}
            onReEvaluate={turnNum => setReEvalModalTurn(turnNum)}
            isReEvaluating={isReEvaluating}
          />
        </div>
      )}

      {/* STATE 5: Session Completed View */}
      {session.state === SessionState.COMPLETED && (
        <Card className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 border-emerald-200 text-center py-10 shadow-sm animate-fade-in">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="bg-emerald-600 text-white p-3.5 rounded-2xl shadow-md">
              <Award className="h-10 w-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {t.interview.completedTitle}
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm max-w-md leading-relaxed">
              {t.interview.completedDesc}{' '}
              <span className="font-bold text-emerald-700 text-base font-mono">
                {formatScore(session.overallScore)} / 10
              </span>
              .
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate(`/interviews/${session.id}/result`)}
                className="gap-2 shadow-sm font-bold"
              >
                <BarChart2 className="h-4 w-4" />
                <span>{t.interview.viewFullResult}</span>
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/interviews/new')}>
                {t.interview.startAnother}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Re-evaluation Modal Dialog */}
      <Modal
        isOpen={reEvalModalTurn !== null}
        onClose={() => setReEvalModalTurn(null)}
        title={`${t.interview.requestReEvaluation} (${language === 'vi' ? 'Lượt' : 'Turn'} ${reEvalModalTurn || 1})`}
        description={
          language === 'vi'
            ? 'AI sẽ đánh giá lại câu trả lời theo các tiêu chí rubric chuẩn hóa.'
            : 'AI Orchestrator will re-assess your answer with deterministic rubrics.'
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="re-eval-reason-input"
              className="text-xs font-semibold text-slate-700 block"
            >
              {t.interview.reEvaluationPrompt}
            </label>
            <textarea
              id="re-eval-reason-input"
              value={reEvalReason}
              onChange={e => setReEvalReason(e.target.value)}
              placeholder={
                language === 'vi'
                  ? 'VD: Đã làm rõ thêm về cơ chế transaction isolation và xử lý lỗi...'
                  : 'E.g. Elaborated on transactional isolation and resilience...'
              }
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
      </Modal>

      {/* Pre-Interview Green Room Modal */}
      <GreenRoomModal
        isOpen={isGreenRoomOpen}
        onClose={() => {
          try {
            sessionStorage.setItem(`greenroom-skipped-${sessionId}`, 'true');
          } catch {
            // sessionStorage unavailable fallback
          }
          setIsGreenRoomOpen(false);
        }}
        onReady={() => {
          try {
            sessionStorage.setItem(`greenroom-done-${sessionId}`, 'true');
          } catch {
            // sessionStorage unavailable fallback
          }
          setIsGreenRoomOpen(false);
        }}
        sessionId={sessionId || ''}
        roleTitle={session?.jobRole?.name}
      />
    </div>
  );
}

export default InterviewRoomPage;
