import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  AudioLines,
  Headphones,
  CheckCheck,
  ArrowRight,
  ArrowLeft,
  LoaderCircle,
  Clock3,
  LogOut,
  Check,
  WifiOff,
  Square,
  Volume2,
  Lightbulb,
  ChevronDown,
  PenLine,
  History,
  LockKeyhole,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useVoiceStreaming } from '../../hooks/useVoiceStreaming';
import { SpeakerRole } from '@ai-interview/contracts';
import { apiClient } from '../../lib/api-client';
import './VoiceInterviewRoom.css';

interface VoiceInterviewRoomProps {
  interviewId: string;
  roleName?: string;
  levelName?: string;
  onFinish?: () => void;
  onRestAnswerSubmit?: (text: string, turnId: string) => Promise<void>;
  turnId?: string;
  userId?: string;
  hasAnswer?: boolean;
  turnNumber?: number;
  totalTurns?: number;
  conversationHistory?: Array<{ id: string; speaker: string; text: string }>;
  currentQuestion?: string;
  sessionState?: string;
}

export const VoiceInterviewRoom: React.FC<VoiceInterviewRoomProps> = ({
  interviewId,
  roleName = 'Senior Software Engineer',
  levelName = 'SENIOR',
  onFinish,
  onRestAnswerSubmit,
  currentQuestion,
  sessionState,
  turnId,
  userId,
  hasAnswer = false,
  turnNumber,
  totalTurns,
  conversationHistory,
}) => {
  const navigate = useNavigate();
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const previousRecordingStatus = useRef('IDLE');
  const [draftStatus, setDraftStatus] = useState<'empty' | 'saved' | 'restored' | 'unavailable'>(
    'empty',
  );
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [hasConsented, setHasConsented] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [isSubmittingConsent, setIsSubmittingConsent] = useState(false);
  const [fallbackText, setFallbackText] = useState('');
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [submittingFallback, setSubmittingFallback] = useState(false);

  const {
    errorMessage,

    sessionCompleted,
    connectionStatus,
    connect,
    disconnect,
    recordingStatus,
    recordingText,
    startRecording,
    stopRecording,
    replayQuestion,
    isAiSpeaking,
    candidateVolume,
    silenceDurationSec,
    isProlongedSilence,
    resetSilenceTimer,
    isFallbackToRest,
    transcripts,
    triggerBargeIn,
    initPlaybackAudio,
  } = useVoiceStreaming(interviewId);

  const draftKey = userId && turnId ? `voice-draft-v2:${userId}:${interviewId}:${turnId}` : '';
  const loadedDraftKey = useRef('');
  const recordingBase = useRef('');
  const recordingTurn = useRef<string>();
  const submittingRef = useRef(false);
  const [acceptedTurn, setAcceptedTurn] = useState<string>();
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const busyRecording = recordingStatus !== 'IDLE';
  const canAnswer =
    !!turnId &&
    !!currentQuestion &&
    sessionState === 'ACTIVE' &&
    !hasAnswer &&
    acceptedTurn !== turnId;

  useEffect(() => {
    if (loadedDraftKey.current === draftKey) return;
    if (busyRecording) void stopRecording();
    loadedDraftKey.current = draftKey;
    recordingTurn.current = undefined;
    recordingBase.current = '';
    setFallbackError(null);
    setDraftStatus('empty');
    try {
      const saved = draftKey ? JSON.parse(window.localStorage.getItem(draftKey) || 'null') : null;
      if (typeof saved?.text === 'string' && saved.text && Date.now() - saved.updatedAt < 86400000)
        setDraftStatus('restored');
      setFallbackText(
        typeof saved?.text === 'string' &&
          typeof saved.updatedAt === 'number' &&
          Date.now() - saved.updatedAt < 86400000
          ? saved.text
          : '',
      );
    } catch {
      setFallbackText('');
    }
  }, [draftKey]);

  const saveDraft = (text: string) => {
    setFallbackText(text);
    if (!draftKey) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ text, updatedAt: Date.now() }));
      setDraftStatus(text ? 'saved' : 'empty');
    } catch {
      setDraftStatus('unavailable');
      setFallbackError('Trình duyệt không lưu được bản nháp. Hãy sao chép trước khi rời trang.');
    }
  };
  useEffect(() => {
    if (recordingTurn.current !== turnId) return;
    saveDraft([recordingBase.current, recordingText].filter(Boolean).join(' '));
  }, [recordingText, turnId]);
  useEffect(() => {
    if (recordingStatus !== 'RECORDING') return;
    setRecordingSeconds(0);
    const timer = setInterval(() => setRecordingSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recordingStatus]);
  useEffect(() => {
    if (recordingStatus === 'RECORDING' && recordingSeconds >= 180) void stopRecording();
  }, [recordingSeconds, recordingStatus]);
  useEffect(() => {
    if (!fallbackText.trim() && !busyRecording) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [fallbackText, busyRecording]);

  const beginRecording = () => {
    if (!canAnswer || busyRecording || !turnId) return;
    recordingBase.current = fallbackText.trim();
    recordingTurn.current = turnId;
    setRecordingSeconds(0);
    startRecording(turnId);
  };

  useEffect(() => {
    if (sessionCompleted || sessionState === 'COMPLETED')
      navigate(`/interviews/${interviewId}/result`);
  }, [sessionCompleted, sessionState, interviewId, navigate]);

  // Global user-gesture handler to unlock Web Audio API autoplay in browsers
  useEffect(() => {
    const unlockAudio = () => {
      initPlaybackAudio();
    };
    window.addEventListener('click', unlockAudio, { capture: true });
    window.addEventListener('keydown', unlockAudio, { capture: true });
    window.addEventListener('touchstart', unlockAudio, { capture: true });
    return () => {
      window.removeEventListener('click', unlockAudio, { capture: true });
      window.removeEventListener('keydown', unlockAudio, { capture: true });
      window.removeEventListener('touchstart', unlockAudio, { capture: true });
    };
  }, [initPlaybackAudio]);

  useEffect(() => {
    if (!hasConsented) return;
    connect();

    return () => {
      disconnect();
    };
  }, [interviewId, connect, disconnect, hasConsented]);

  useEffect(() => {
    if (connectionStatus !== 'LIVE') return;
    const timer = setInterval(() => setElapsedSec(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [connectionStatus]);

  useEffect(() => {
    if (recordingStatus === 'IDLE' && previousRecordingStatus.current === 'FINALIZING')
      answerInputRef.current?.focus({ preventScroll: true });
    previousRecordingStatus.current = recordingStatus;
  }, [recordingStatus]);
  useEffect(() => {
    if (busyRecording && answerInputRef.current)
      answerInputRef.current.scrollTop = answerInputRef.current.scrollHeight;
  }, [recordingText, busyRecording]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    if (fallbackText.trim() || busyRecording) {
      setShowLeaveDialog(true);
      return;
    }
    leaveSession();
  };
  const leaveSession = () => {
    disconnect();
    if (onFinish) {
      onFinish();
    } else {
      navigate('/history');
    }
  };

  const handleFallbackAnswer = async (text: string) => {
    if (
      !onRestAnswerSubmit ||
      submittingRef.current ||
      !text.trim() ||
      !turnId ||
      !canAnswer ||
      busyRecording
    )
      return;
    submittingRef.current = true;
    const submittedTurn = turnId;
    const submittedKey = draftKey;
    setSubmittingFallback(true);
    setFallbackError(null);
    try {
      await onRestAnswerSubmit(text.trim(), submittedTurn);
      setAcceptedTurn(submittedTurn);
      if (loadedDraftKey.current === submittedKey) saveDraft('');
    } catch (err: any) {
      if (loadedDraftKey.current === submittedKey) setFallbackText(text);
      setFallbackError(err?.message || 'Không thể gửi câu trả lời. Vui lòng thử lại.');
    } finally {
      submittingRef.current = false;
      setSubmittingFallback(false);
    }
  };

  const handleGrantConsent = async () => {
    initPlaybackAudio();
    setIsSubmittingConsent(true);
    setConsentError(null);
    try {
      await apiClient.post('/voice-gateway/consent', {
        interviewId,
        policyVersion: 'VOICE-PRIVACY-2026.08',
      });
      setHasConsented(true);
    } catch (err: any) {
      setConsentError(err?.message || 'Chưa thể lưu xác nhận. Vui lòng thử lại.');
    } finally {
      setIsSubmittingConsent(false);
    }
  };

  const submitted =
    (!!turnId && acceptedTurn === turnId) || hasAnswer || sessionState === 'EVALUATING';
  const isRecording = recordingStatus === 'RECORDING';
  const connectionLost =
    isFallbackToRest || connectionStatus === 'ERROR' || connectionStatus === 'ENDED';
  const step = submitted || submittingFallback ? 3 : busyRecording || fallbackText.trim() ? 2 : 1;
  const wordCount = fallbackText.trim() ? fallbackText.trim().split(/\s+/u).length : 0;
  const statusTitle = submittingFallback
    ? 'Đang gửi câu trả lời'
    : submitted
      ? 'Đã nhận câu trả lời'
      : recordingStatus === 'STARTING'
        ? 'Đang bật micro'
        : recordingStatus === 'FINALIZING'
          ? 'Đang hoàn tất nhận diện'
          : isRecording
            ? 'Đang ghi âm'
            : !canAnswer
              ? 'Đang chuẩn bị câu hỏi'
              : fallbackText.trim()
                ? 'Kiểm tra trước khi gửi'
                : 'Sẵn sàng khi bạn sẵn sàng';
  const statusHint = submitted
    ? 'AI đang đánh giá và chuẩn bị bước tiếp theo.'
    : isRecording
      ? 'Nói tự nhiên. Dừng ghi âm khi bạn muốn xem lại.'
      : recordingStatus === 'FINALIZING'
        ? 'Chờ phần cuối được chuyển thành chữ.'
        : recordingStatus === 'STARTING'
          ? 'Cho phép truy cập micro nếu trình duyệt yêu cầu.'
          : fallbackText.trim()
            ? 'Bạn có thể sửa nội dung hoặc nói bổ sung.'
            : 'Bấm micro để trả lời, hoặc nhập trực tiếp bên dưới.';
  const historyItems =
    conversationHistory ||
    transcripts.map((item, index) => ({
      id: String(index),
      speaker: item.speaker === SpeakerRole.AI ? 'AI' : 'USER',
      text: item.text,
    }));
  const connectionLabel =
    connectionStatus === 'LIVE'
      ? 'Đã kết nối'
      : connectionStatus === 'CONNECTING'
        ? 'Đang kết nối'
        : connectionLost
          ? 'Chế độ nhập chữ'
          : 'Chưa kết nối';

  if (!hasConsented) {
    return (
      <div className="voice-studio vi-welcome" data-testid="voice-consent-modal">
        <section className="vi-welcome-story">
          <div className="vi-brand">
            <span className="vi-brand-icon">
              <AudioLines size={22} />
            </span>{' '}
            INTERVIEW STUDIO
          </div>
          <div className="vi-welcome-copy">
            <span className="vi-eyebrow">LUYỆN TẬP BẰNG GIỌNG NÓI</span>
            <h1>
              Tự tin hơn.
              <br />
              Từng câu trả lời.
            </h1>
            <p>Một không gian để suy nghĩ, diễn đạt và hoàn thiện câu trả lời theo nhịp của bạn.</p>
          </div>
          <ol className="vi-welcome-steps">
            <li>
              <Headphones />
              <div>
                <strong>Nghe câu hỏi</strong>
                <span>Đọc lại hoặc dừng giọng AI bất cứ lúc nào.</span>
              </div>
            </li>
            <li>
              <Mic />
              <div>
                <strong>Trả lời theo cách của bạn</strong>
                <span>Bấm micro để nói, hoặc nhập bằng bàn phím.</span>
              </div>
            </li>
            <li>
              <CheckCheck />
              <div>
                <strong>Xem lại, rồi mới gửi</strong>
                <span>Chỉnh sửa bản nhận diện trước khi AI đánh giá.</span>
              </div>
            </li>
          </ol>
          <div className="vi-welcome-role">
            <span>{roleName}</span>
            <span>{levelName}</span>
          </div>
        </section>
        <section className="vi-welcome-consent">
          <span className="vi-icon-tile">
            <ShieldCheck size={26} />
          </span>
          <h2>Sẵn sàng cho cuộc phỏng vấn?</h2>
          <p className="vi-muted">Micro chỉ bật khi bạn chủ động bắt đầu ghi âm.</p>
          <div className="vi-privacy">
            <h3>Quyền riêng tư & xử lý giọng nói</h3>
            <ul>
              <li>
                Âm thanh được truyền tới máy chủ và dịch vụ nhận diện Deepgram để chuyển thành chữ.
                Dịch vụ đọc câu hỏi xử lý nội dung trong thời gian thực.
              </li>
              <li>
                Hệ thống không lưu trữ vĩnh viễn file âm thanh gốc. Biên bản văn bản được lưu tối đa
                30 ngày theo chính sách lưu trữ.
              </li>
              <li>
                Bản nháp trên thiết bị có thể khôi phục trong 24 giờ. Bạn có thể dừng thu âm hoặc
                rời phiên bất cứ lúc nào.
              </li>
            </ul>
          </div>
          {consentError && (
            <p role="alert" className="vi-notice vi-notice-error">
              <AlertCircle size={18} />
              {consentError}
            </p>
          )}
          <Button
            className="vi-button vi-consent-cta"
            onClick={handleGrantConsent}
            disabled={isSubmittingConsent}
          >
            {isSubmittingConsent ? (
              <LoaderCircle className="vi-spin" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
            {isSubmittingConsent ? 'Đang mở phòng phỏng vấn...' : 'Đồng ý và bắt đầu'}
          </Button>
          <p className="vi-fine-print">
            Bằng cách tiếp tục, bạn đồng ý với việc xử lý giọng nói được mô tả ở trên.
          </p>
          <Button
            variant="ghost"
            className="vi-button vi-back"
            onClick={() => navigate(-1)}
            disabled={isSubmittingConsent}
          >
            <ArrowLeft size={16} />
            Quay lại
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="voice-studio" data-testid="voice-interview-room">
      <header className="vi-header">
        <div className="vi-heading">
          <span className="vi-brand-icon">
            <AudioLines size={24} />
          </span>
          <div>
            <p className="vi-eyebrow">INTERVIEW STUDIO</p>
            <h1>Phỏng vấn giọng nói</h1>
            <p className="vi-session-meta">
              {roleName}
              <span aria-hidden="true"> / </span>
              {levelName}
            </p>
          </div>
        </div>
        <div className="vi-header-actions">
          <span
            className={`vi-connection ${connectionLost ? 'vi-connection-offline' : ''}`}
            data-testid="voice-connection"
          >
            <span className="vi-status-dot" />
            {connectionLabel}
          </span>
          <span className="vi-clock" aria-label={`Thời lượng phiên ${formatTime(elapsedSec)}`}>
            <Clock3 size={15} />
            {formatTime(elapsedSec)}
          </span>
          <Button
            variant="ghost"
            className="vi-button vi-leave"
            onClick={handleEndCall}
            disabled={submittingFallback}
          >
            <LogOut size={16} />
            Rời phiên
          </Button>
        </div>
      </header>

      <div className="vi-progress-row">
        <div className="vi-question-count">
          Câu <strong>{String(turnNumber || 1).padStart(2, '0')}</strong>
          {totalTurns ? <span> / {String(totalTurns).padStart(2, '0')}</span> : null}
        </div>
        <ol className="vi-steps" aria-label="Các bước trả lời">
          {['Nghe câu hỏi', 'Trả lời & chỉnh sửa', 'Gửi cho AI'].map((label, index) => (
            <li
              key={label}
              className={
                step === index + 1 ? 'vi-step-current' : step > index + 1 ? 'vi-step-done' : ''
              }
              aria-current={step === index + 1 ? 'step' : undefined}
            >
              <span>{step > index + 1 ? <Check size={12} /> : index + 1}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </div>

      {connectionLost ? (
        <div
          className="vi-notice vi-connection-notice"
          role="alert"
          data-testid="voice-fallback-banner"
        >
          <WifiOff size={20} />
          <div>
            <strong>Giọng nói đang gián đoạn</strong>
            <p>Bản nháp vẫn ở đây. Bạn có thể nhập và gửi câu trả lời.</p>
            {errorMessage && (
              <details>
                <summary>Chi tiết kết nối</summary>
                <p>{errorMessage}</p>
              </details>
            )}
          </div>
          <Button
            variant="outline"
            className="vi-button"
            onClick={connect}
            disabled={connectionStatus === 'CONNECTING'}
          >
            <RefreshCw size={15} />
            Kết nối lại
          </Button>
        </div>
      ) : errorMessage ? (
        <div role="alert" className="vi-notice">
          <AlertCircle size={18} />
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <div className="vi-workspace">
        <div className="vi-question-column">
          <section className="vi-question" aria-labelledby="voice-question-heading">
            <div className="vi-question-top">
              <span className="vi-interviewer">
                <span className="vi-ai-mark">
                  <Sparkles size={18} />
                </span>
                AI Interviewer
              </span>
              <span className="vi-speaking-label">
                {isAiSpeaking ? (
                  <>
                    <span className="vi-status-dot" />
                    Đang đọc câu hỏi
                  </>
                ) : (
                  <>
                    <Headphones size={14} />
                    Câu hỏi dành cho bạn
                  </>
                )}
              </span>
            </div>
            <div className="vi-question-body">
              <p className="vi-eyebrow" id="voice-question-heading">
                CÂU HỎI {String(turnNumber || 1).padStart(2, '0')}
              </p>
              {currentQuestion ? (
                <h2>{currentQuestion}</h2>
              ) : (
                <div className="vi-question-loading" role="status">
                  <LoaderCircle className="vi-spin" />
                  <h2>Đang chuẩn bị câu hỏi...</h2>
                  <p>Bạn có thể dành một chút thời gian để sẵn sàng.</p>
                </div>
              )}
            </div>
            <div className="vi-question-bottom">
              <Button
                variant="outline"
                className="vi-button vi-playback"
                disabled={
                  !isAiSpeaking &&
                  (!turnId || !canAnswer || busyRecording || connectionStatus !== 'LIVE')
                }
                onClick={() => (isAiSpeaking ? triggerBargeIn() : turnId && replayQuestion(turnId))}
              >
                {isAiSpeaking ? <Square size={15} /> : <Volume2 size={17} />}
                {isAiSpeaking ? 'Dừng đọc' : 'Đọc lại câu hỏi'}
              </Button>
              <span>
                {isAiSpeaking ? 'Bấm micro khi bạn sẵn sàng trả lời.' : 'Nghe lại câu hỏi khi cần.'}
              </span>
            </div>
          </section>
          <details className="vi-coach">
            <summary>
              <span>
                <Lightbulb size={18} />
                Một cách trình bày rõ ràng
              </span>
              <ChevronDown size={16} />
            </summary>
            <p>
              Nêu cách tiếp cận, giải thích lý do, rồi đưa ra một ví dụ và những đánh đổi. Bạn không
              cần vội; hãy ưu tiên câu trả lời có cấu trúc.
            </p>
          </details>
          <div className="vi-reassurance">
            <ShieldCheck size={16} />
            <p>
              Bạn kiểm soát nội dung gửi đi.
              <br />
              <span>Đánh giá dựa trên câu trả lời, không chấm phát âm.</span>
            </p>
          </div>
        </div>

        <section
          className={`vi-answer ${isRecording ? 'vi-answer-recording' : ''}`}
          aria-labelledby="voice-answer-heading"
        >
          <div className="vi-answer-header">
            <div>
              <p className="vi-eyebrow">KHÔNG GIAN CỦA BẠN</p>
              <h2 id="voice-answer-heading">Câu trả lời của bạn</h2>
            </div>
            <span className="vi-answer-icon">
              {submitted ? <CheckCheck size={21} /> : <PenLine size={21} />}
            </span>
          </div>

          <div className={`vi-recorder ${isRecording ? 'vi-recorder-active' : ''}`}>
            <div className="vi-recorder-info">
              <span className="vi-recorder-icon">
                {isRecording ? (
                  <Mic size={20} />
                ) : busyRecording || submittingFallback ? (
                  <LoaderCircle className="vi-spin" size={20} />
                ) : submitted ? (
                  <Check size={20} />
                ) : (
                  <MicOff size={20} />
                )}
              </span>
              <div role="status" aria-live="polite">
                <strong>{statusTitle}</strong>
                <p>{statusHint}</p>
              </div>
            </div>
            {isRecording && (
              <div className="vi-recording-meter">
                <div
                  className="vi-wave"
                  role="meter"
                  aria-label="Mức âm thanh micro"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(Math.min(1, (candidateVolume || 0) * 5) * 100)}
                >
                  {Array.from({ length: 24 }, (_, index) => (
                    <i
                      key={index}
                      style={{
                        height: `${4 + (10 + ((index * 7) % 23)) * Math.min(1, (candidateVolume || 0) * 8)}px`,
                      }}
                    />
                  ))}
                </div>
                <span className="vi-recording-time">
                  {formatTime(recordingSeconds)}
                  <small> / 03:00</small>
                </span>
              </div>
            )}
          </div>

          {isRecording && isProlongedSilence && (
            <div className="vi-inline-hint" data-testid="voice-silence-hint">
              <p>
                Chưa nghe thấy giọng nói trong {silenceDurationSec}s. Kiểm tra micro hoặc dừng để
                sửa bản nháp.
              </p>
              <button type="button" onClick={resetSilenceTimer}>
                Đã hiểu
              </button>
            </div>
          )}
          {isRecording && recordingSeconds >= 150 && (
            <p className="vi-inline-hint" role="status">
              Còn {180 - recordingSeconds} giây. Hết giờ, bản nháp sẽ được giữ lại để bạn xem trước
              khi gửi.
            </p>
          )}

          {submitted ? (
            <div className="vi-accepted" data-testid="voice-answer-accepted">
              <span>
                <CheckCheck size={30} />
              </span>
              <h3>Câu trả lời đã được gửi</h3>
              <p>
                {sessionState === 'EVALUATING'
                  ? 'AI đang đánh giá nội dung của bạn.'
                  : 'Đang chuẩn bị bước tiếp theo cho phiên phỏng vấn.'}
              </p>
              <div className="vi-wait-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
          ) : (
            <>
              <div className="vi-editor">
                <label className="vi-editor-label" htmlFor="voice-answer-text">
                  <span>Bản nháp câu trả lời</span>
                  <span>
                    {busyRecording ? 'Đang chuyển giọng nói thành chữ' : 'Có thể chỉnh sửa'}
                  </span>
                </label>
                <textarea
                  ref={answerInputRef}
                  id="voice-answer-text"
                  aria-label="Câu trả lời của bạn"
                  aria-describedby="voice-answer-help"
                  rows={7}
                  value={fallbackText}
                  readOnly={busyRecording || submittingFallback || !canAnswer}
                  placeholder={
                    busyRecording
                      ? 'Lời nói của bạn sẽ xuất hiện ở đây...'
                      : 'Bắt đầu bằng ý chính của bạn…\n\nBấm micro để nói hoặc nhập câu trả lời tại đây.'
                  }
                  onChange={event => {
                    recordingTurn.current = undefined;
                    saveDraft(event.target.value);
                  }}
                />
                <div className="vi-draft-meta">
                  <span>
                    {draftStatus === 'restored' ? (
                      <>
                        <History size={13} />
                        Đã khôi phục bản nháp
                      </>
                    ) : draftStatus === 'saved' && fallbackText ? (
                      <>
                        <Check size={13} />
                        Đã lưu trên thiết bị
                      </>
                    ) : draftStatus === 'unavailable' ? (
                      'Chưa lưu được bản nháp'
                    ) : (
                      <>
                        <LockKeyhole size={13} />
                        Chưa gửi cho AI
                      </>
                    )}
                  </span>
                  <span>{wordCount} từ</span>
                </div>
              </div>
              {fallbackError && (
                <p role="alert" className="vi-notice vi-notice-error">
                  <AlertCircle size={17} />
                  {fallbackError}
                </p>
              )}
              <div className="vi-answer-actions">
                {isRecording ? (
                  <Button
                    variant="danger"
                    className="vi-button vi-record-button"
                    onClick={() => void stopRecording()}
                  >
                    <Square size={15} fill="currentColor" />
                    Dừng ghi âm
                  </Button>
                ) : (
                  <Button
                    variant={fallbackText.trim() ? 'outline' : 'primary'}
                    className="vi-button vi-record-button"
                    disabled={
                      !canAnswer ||
                      busyRecording ||
                      submittingFallback ||
                      connectionStatus !== 'LIVE'
                    }
                    onClick={beginRecording}
                  >
                    {busyRecording ? (
                      <LoaderCircle className="vi-spin" size={17} />
                    ) : (
                      <Mic size={18} />
                    )}
                    {recordingStatus === 'STARTING'
                      ? 'Đang bật micro...'
                      : recordingStatus === 'FINALIZING'
                        ? 'Đang nhận diện...'
                        : fallbackText.trim()
                          ? 'Nói bổ sung'
                          : 'Bắt đầu trả lời'}
                  </Button>
                )}
                <Button
                  className="vi-button vi-send-button"
                  disabled={
                    !canAnswer ||
                    busyRecording ||
                    submittingFallback ||
                    !fallbackText.trim() ||
                    !onRestAnswerSubmit
                  }
                  onClick={() => void handleFallbackAnswer(fallbackText)}
                >
                  {submittingFallback ? (
                    <LoaderCircle className="vi-spin" size={17} />
                  ) : (
                    <ArrowUpRight size={18} />
                  )}
                  {submittingFallback ? 'Đang gửi...' : 'Gửi câu trả lời'}
                </Button>
              </div>
              <p className="vi-answer-help" id="voice-answer-help">
                {busyRecording
                  ? 'Dừng ghi âm để chỉnh sửa và gửi câu trả lời.'
                  : 'Kiểm tra thuật ngữ và nội dung trước khi gửi cho AI.'}
              </p>
            </>
          )}
        </section>
      </div>

      <details className="vi-history">
        <summary>
          <span>
            <History size={17} />
            Nội dung đã trao đổi <small>{historyItems.length}</small>
          </span>
          <ChevronDown size={17} />
        </summary>
        <div
          role="log"
          aria-live="polite"
          aria-label="Nội dung phiên phỏng vấn"
          className="vi-history-content"
        >
          {historyItems.length ? (
            historyItems.map(item => (
              <div key={item.id} className="vi-history-item">
                <span>{item.speaker === 'AI' ? 'AI' : 'Bạn'}</span>
                <p>{item.text}</p>
              </div>
            ))
          ) : (
            <p>Nội dung sẽ xuất hiện khi cuộc phỏng vấn bắt đầu.</p>
          )}
        </div>
      </details>
      <footer className="vi-footer">
        <span>
          <LockKeyhole size={13} />
          Micro chỉ bật khi bạn bắt đầu ghi âm
        </span>
        <span>Bản nháp có thể khôi phục trong 24 giờ</span>
      </footer>

      <Modal
        isOpen={showLeaveDialog}
        onClose={() => setShowLeaveDialog(false)}
        title="Rời phiên và tiếp tục sau?"
        description="Bạn còn nội dung chưa gửi."
        maxWidth="sm"
      >
        <p className="vi-leave-copy">
          {busyRecording
            ? 'Hãy dừng ghi âm và kiểm tra bản nháp trước khi rời phiên để giữ đầy đủ phần nhận diện cuối.'
            : draftStatus === 'unavailable'
              ? 'Bản nháp chưa lưu được trên thiết bị. Hãy sao chép nội dung trước khi rời phiên.'
              : 'Bản nháp đã lưu trên thiết bị này. Bạn có thể quay lại phiên để tiếp tục.'}
        </p>
        <div className="vi-dialog-actions">
          <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
            Ở lại
          </Button>
          <Button
            onClick={() => {
              setShowLeaveDialog(false);
              leaveSession();
            }}
            disabled={busyRecording}
          >
            Rời phiên
          </Button>
        </div>
      </Modal>
    </div>
  );
};
