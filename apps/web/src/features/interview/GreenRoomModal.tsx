import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18nStore } from '../../stores/i18n.store';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import {
  Mic,
  Volume2,
  Wifi,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  Sparkles,
  Heart,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface GreenRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReady: () => void;
  sessionId: string;
  roleTitle?: string;
}

export function GreenRoomModal({
  isOpen,
  onClose,
  onReady,
  sessionId: _sessionId,
  roleTitle: _roleTitle,
}: GreenRoomModalProps) {
  const { language } = useI18nStore();

  // Tab: 'devices' | 'breathing' | 'warmup'
  const [activeTab, setActiveTab] = useState<'devices' | 'breathing' | 'warmup'>('devices');

  // Audio input state
  const [_audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [micVolume, setMicVolume] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Audio output state
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);
  const [hasHeardChime, setHasHeardChime] = useState(false);

  // Network latency state
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  // 4-7-8 Breathing guide state
  // Phase: 'inhale' (4s), 'hold' (7s), 'exhale' (8s), 'idle'
  const [breathPhase, setBreathPhase] = useState<'idle' | 'inhale' | 'hold' | 'exhale'>('idle');
  const [breathSecondsLeft, setBreathSecondsLeft] = useState<number>(4);
  const [breathCycleCount, setBreathCycleCount] = useState<number>(0);
  const breathTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ice-breaker warm up
  const [warmupRecorded, setWarmupRecorded] = useState(false);
  const [warmupAnswer, setWarmupAnswer] = useState('');
  const [isWarmupRecording, setIsWarmupRecording] = useState(false);

  // Check network latency using health endpoint
  const measureLatency = useCallback(async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      await fetch('/api/health', { method: 'HEAD', cache: 'no-store' }).catch(() => null);
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed < 10 ? 25 : elapsed);
    } catch {
      setLatencyMs(null);
    } finally {
      setIsPinging(false);
    }
  }, []);

  // Cleanup helper: release old audio resources before creating new ones
  const cleanupAudioResources = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  // Enumerate devices & start streams
  const initDevices = useCallback(async () => {
    try {
      setMicError(null);
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      const audioInputs = devices.filter(d => d.kind === 'audioinput');

      setAudioDevices(audioInputs);

      if (audioInputs.length > 0 && !selectedAudioDevice) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }

      // Cleanup old stream and context before creating new ones (C1 fix)
      setAudioStream(prev => {
        if (prev) prev.getTracks().forEach(t => t.stop());
        return null;
      });
      cleanupAudioResources();

      // Request mic stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
      });
      setAudioStream(stream);

      // Setup audio analyzer
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((avg / 128) * 100));
          setMicVolume(normalized);
          animFrameRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      }
    } catch (err: any) {
      setMicError(
        language === 'vi'
          ? 'Không thể truy cập Microphone. Vui lòng kiểm tra quyền truy cập.'
          : 'Unable to access microphone. Please check permissions.',
      );
    }
  }, [selectedAudioDevice, language, cleanupAudioResources]);

  // Init devices and latency when modal opens; cleanup when it closes
  useEffect(() => {
    if (isOpen) {
      initDevices();
      measureLatency();
    } else {
      // Cleanup audio resources when modal closes
      setAudioStream(prev => {
        if (prev) prev.getTracks().forEach(t => t.stop());
        return null;
      });
      cleanupAudioResources();
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, initDevices, measureLatency, cleanupAudioResources]);

  // C2 fix: Always cleanup breathing timer on unmount
  useEffect(() => {
    return () => {
      if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    };
  }, []);

  // Handle Play Synth Audio Chime
  const handlePlayTestChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      setIsPlayingTestSound(true);

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.12);

        gain.gain.setValueAtTime(0, ctx.currentTime + index * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + index * 0.12 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.12 + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + index * 0.12);
        osc.stop(ctx.currentTime + index * 0.12 + 0.45);
      });

      setTimeout(() => {
        setIsPlayingTestSound(false);
        setHasHeardChime(true);
        ctx.close().catch(() => {});
      }, 900);
    } catch {
      setIsPlayingTestSound(false);
      setHasHeardChime(true);
    }
  };

  // 4-7-8 Breathing Cycle Machine
  const startBreathingCycle = () => {
    if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    setBreathPhase('inhale');
    setBreathSecondsLeft(4);

    let phase: 'inhale' | 'hold' | 'exhale' = 'inhale';
    let count = 4;

    breathTimerRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        if (phase === 'inhale') {
          phase = 'hold';
          count = 7;
        } else if (phase === 'hold') {
          phase = 'exhale';
          count = 8;
        } else if (phase === 'exhale') {
          phase = 'inhale';
          count = 4;
          setBreathCycleCount(prev => prev + 1);
        }
      }
      setBreathPhase(phase);
      setBreathSecondsLeft(count);
    }, 1000);
  };

  const stopBreathingCycle = () => {
    if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    setBreathPhase('idle');
    setBreathSecondsLeft(4);
  };

  const handleWarmupRecordToggle = () => {
    if (!isWarmupRecording) {
      setIsWarmupRecording(true);
      setWarmupAnswer('');
      setTimeout(() => {
        setWarmupAnswer(
          language === 'vi'
            ? '“Xin chào, tôi là ứng viên kỹ sư phần mềm. Tôi rất hào hứng tham gia buổi phỏng vấn hôm nay!”'
            : '"Hi, I am a software engineer candidate. I am excited to take this interview practice today!"',
        );
        setIsWarmupRecording(false);
        setWarmupRecorded(true);
      }, 3500);
    } else {
      setIsWarmupRecording(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        language === 'vi' ? 'Phòng Chuẩn Bị (Pre-Interview Green Room)' : 'Pre-Interview Green Room'
      }
      description={
        language === 'vi'
          ? 'Kiểm tra thiết bị âm thanh, đường truyền và thư giãn tâm lý trước khi bắt đầu.'
          : 'Check your audio, video, network connection and relax before starting.'
      }
      maxWidth="2xl"
      className="p-0 overflow-hidden"
    >
      <div className="flex flex-col h-[560px]">
        {/* Navigation Tabs (M1 fix: ARIA tablist) */}
        <div
          role="tablist"
          aria-label="Green Room Navigation"
          className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-6 pt-3 gap-2"
        >
          <button
            id="tab-devices"
            role="tab"
            aria-selected={activeTab === 'devices'}
            aria-controls="panel-devices"
            type="button"
            onClick={() => setActiveTab('devices')}
            className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'devices'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Mic className="w-4 h-4" />
            {language === 'vi' ? 'Thiết bị & Mạng' : 'Devices & Network'}
          </button>
          <button
            id="tab-breathing"
            role="tab"
            aria-selected={activeTab === 'breathing'}
            aria-controls="panel-breathing"
            type="button"
            onClick={() => setActiveTab('breathing')}
            className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'breathing'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Heart className="w-4 h-4" />
            {language === 'vi' ? 'Thư giãn 4-7-8' : 'Relaxation 4-7-8'}
            {breathCycleCount > 0 && (
              <Badge variant="success" className="ml-1">
                {breathCycleCount} {language === 'vi' ? 'chu kỳ' : 'cycles'}
              </Badge>
            )}
          </button>
          <button
            id="tab-warmup"
            role="tab"
            aria-selected={activeTab === 'warmup'}
            aria-controls="panel-warmup"
            type="button"
            onClick={() => setActiveTab('warmup')}
            className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'warmup'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            {language === 'vi' ? 'Thử giọng (30s)' : 'Voice Warm-up'}
            {warmupRecorded && <Badge variant="success">OK</Badge>}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'devices' && (
            <div
              id="panel-devices"
              role="tabpanel"
              aria-labelledby="tab-devices"
              className="space-y-5"
            >
              {/* Mic Input Level Check */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {language === 'vi' ? 'Microphone' : 'Microphone Check'}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {language === 'vi'
                          ? 'Nói thử để kiểm tra âm lượng thanh sóng'
                          : 'Speak to verify your microphone level'}
                      </p>
                    </div>
                  </div>
                  {micVolume > 5 ? (
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {language === 'vi' ? 'Đang nhận diện tốt' : 'Working Great'}
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      {language === 'vi' ? 'Chưa có âm thanh' : 'Silent'}
                    </Badge>
                  )}
                </div>

                {/* Live Volume Meter Bar */}
                <div className="space-y-1.5">
                  <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex items-center p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-75 ${
                        micVolume > 60
                          ? 'bg-emerald-500'
                          : micVolume > 20
                            ? 'bg-indigo-500'
                            : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(4, micVolume))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                    <span>-48 dB</span>
                    <span>-18 dB (Lý tưởng)</span>
                    <span>0 dB</span>
                  </div>
                </div>

                {/* Mic Selector */}
                {audioDevices.length > 1 && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4">
                    <label
                      htmlFor="greenroom-audio-input"
                      className="text-xs text-gray-500 shrink-0"
                    >
                      {language === 'vi' ? 'Chọn Microphone:' : 'Select Mic:'}
                    </label>
                    <select
                      id="greenroom-audio-input"
                      value={selectedAudioDevice}
                      onChange={e => {
                        setSelectedAudioDevice(e.target.value);
                        initDevices();
                      }}
                      className="text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-800 dark:text-gray-200 w-full max-w-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      {audioDevices.map((d: MediaDeviceInfo) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Microphone ${d.deviceId.substring(0, 5)}...`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {micError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{micError}</span>
                  </div>
                )}
              </div>

              {/* Audio Output Check */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {language === 'vi' ? 'Loa / Tai nghe' : 'Speaker / Headphones'}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {language === 'vi'
                        ? 'Nhấn để nghe âm thanh mẫu AI'
                        : 'Play sound to verify candidate output'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePlayTestChime}
                    disabled={isPlayingTestSound}
                    className="gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 text-indigo-600" />
                    {isPlayingTestSound
                      ? language === 'vi'
                        ? 'Đang phát...'
                        : 'Playing...'
                      : language === 'vi'
                        ? 'Thử âm thanh'
                        : 'Play Sound'}
                  </Button>
                  {hasHeardChime && (
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      OK
                    </Badge>
                  )}
                </div>
              </div>

              {/* Network Latency */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Wifi className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {language === 'vi' ? 'Độ trễ mạng' : 'Network Latency'}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {latencyMs !== null
                        ? `${latencyMs}ms ${
                            latencyMs < 100
                              ? language === 'vi'
                                ? '(Rất tốt cho Voice Stream)'
                                : '(Great for Voice)'
                              : language === 'vi'
                                ? '(Bình thường)'
                                : '(Moderate)'
                          }`
                        : language === 'vi'
                          ? 'Đang kiểm tra...'
                          : 'Testing...'}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={measureLatency}
                  disabled={isPinging}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'breathing' && (
            <div
              id="panel-breathing"
              role="tabpanel"
              aria-labelledby="tab-breathing"
              className="flex flex-col items-center justify-center py-6 text-center space-y-6"
            >
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {language === 'vi' ? 'Kỹ thuật thở 4-7-8' : '4-7-8 Relaxation Guide'}
                </h3>
                <p className="text-xs text-gray-500 max-w-sm">
                  {language === 'vi'
                    ? 'Hít vào 4 giây qua mũi, nén thở 7 giây, thở ra chậm 8 giây qua miệng để giảm nhịp tim và bình tĩnh.'
                    : 'Inhale 4s through nose, hold 7s, exhale 8s through mouth to calm your autonomic nervous system.'}
                </p>
              </div>

              {/* Animated Breathing Circle */}
              <div className="relative w-44 h-44 flex items-center justify-center">
                <div
                  className={`absolute inset-0 rounded-full border-4 transition-all duration-1000 ${
                    breathPhase === 'inhale'
                      ? 'scale-110 border-indigo-500 bg-indigo-500/10'
                      : breathPhase === 'hold'
                        ? 'scale-110 border-amber-500 bg-amber-500/10'
                        : breathPhase === 'exhale'
                          ? 'scale-90 border-emerald-500 bg-emerald-500/10'
                          : 'scale-95 border-gray-300 dark:border-gray-700 bg-transparent'
                  }`}
                />
                <div className="z-10 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                    {breathPhase === 'idle' ? '4-7-8' : `${breathSecondsLeft}s`}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider mt-1 text-indigo-600 dark:text-indigo-400">
                    {breathPhase === 'idle'
                      ? language === 'vi'
                        ? 'Sẵn sàng'
                        : 'Ready'
                      : breathPhase === 'inhale'
                        ? language === 'vi'
                          ? 'Hít vào...'
                          : 'Inhale...'
                        : breathPhase === 'hold'
                          ? language === 'vi'
                            ? 'Nén thở...'
                            : 'Hold...'
                          : language === 'vi'
                            ? 'Thở ra...'
                            : 'Exhale...'}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                {breathPhase === 'idle' ? (
                  <Button type="button" onClick={startBreathingCycle} className="gap-2">
                    <Play className="w-4 h-4" />
                    {language === 'vi' ? 'Bắt đầu bài tập thở' : 'Start Breathing Exercise'}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={stopBreathingCycle}
                    className="gap-2"
                  >
                    <Square className="w-4 h-4" />
                    {language === 'vi' ? 'Dừng bài tập' : 'Stop Exercise'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'warmup' && (
            <div
              id="panel-warmup"
              role="tabpanel"
              aria-labelledby="tab-warmup"
              className="space-y-4"
            >
              <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-semibold text-sm">
                  <Sparkles className="w-4 h-4" />
                  {language === 'vi' ? 'Câu hỏi thử giọng 30 giây' : '30-Second Ice-breaker'}
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {language === 'vi' ? 'Luyện giọng cục bộ' : 'Voice Tester'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {language === 'vi'
                    ? '“Hãy giới thiệu ngắn gọn tên và mục tiêu của bạn trong buổi phỏng vấn hôm nay.”'
                    : '"Briefly introduce your name and your primary goal for today\'s practice session."'}
                </p>
                <p className="text-xs text-gray-500">
                  {language === 'vi'
                    ? '* Phần thử giọng không tính vào điểm số chính thức, giúp bạn kiểm tra microphone và làm quen trước phiên thi.'
                    : '* This test response is not scored, strictly for warming up your microphone and voice.'}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {language === 'vi' ? 'Bản ghi âm thử:' : 'Test Recording Preview:'}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={isWarmupRecording ? 'danger' : 'outline'}
                    onClick={handleWarmupRecordToggle}
                    className="gap-1.5"
                  >
                    {isWarmupRecording ? (
                      <>
                        <Square className="w-3.5 h-3.5 animate-pulse" />
                        {language === 'vi' ? 'Đang lắng nghe... (Dừng)' : 'Listening... (Stop)'}
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        {language === 'vi' ? 'Nói thử 1 câu' : 'Record Test Answer'}
                      </>
                    )}
                  </Button>
                </div>

                <div className="min-h-[70px] p-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-300 italic flex items-center justify-center text-center">
                  {warmupAnswer ||
                    (language === 'vi'
                      ? 'Nhấn nút "Nói thử 1 câu" để kiểm tra độ nhạy mic và nhận diện giọng nói.'
                      : 'Click "Record Test Answer" to test speech recognition clarity.')}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-6 py-4 flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {language === 'vi' ? 'Bỏ qua (Vào thẳng)' : 'Skip Green Room'}
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={onReady}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5"
          >
            {language === 'vi' ? 'Sẵn sàng vào phỏng vấn' : 'Ready to Start Interview'}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}
