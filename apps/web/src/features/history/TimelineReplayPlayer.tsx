import { useState, useEffect, useRef, useMemo } from 'react';
import { useI18nStore } from '../../stores/i18n.store';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatScore } from '../../lib/utils';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Lightbulb,
} from 'lucide-react';

export interface TurnReplayData {
  turnNumber: number;
  questionContent: string;
  answerText: string;
  score?: number;
  technicalScore?: number;
  depthScore?: number;
  clarityScore?: number;
  evidence?: string[];
  strengths?: string[];
  improvements?: string[];
  modelAnswer?: string;
  timestampStartSec?: number;
  timestampEndSec?: number;
}

interface TimelineReplayPlayerProps {
  turns: TurnReplayData[];
  overallScore?: number;
  roleTitle?: string;
  className?: string;
}

export function TimelineReplayPlayer({
  turns = [],
  overallScore,
  roleTitle: _roleTitle,
  className = '',
}: TimelineReplayPlayerProps) {
  const { language } = useI18nStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [activeTurnNumber, setActiveTurnNumber] = useState<number>(1);
  const [selectedTurnForDetail, setSelectedTurnForDetail] = useState<number | null>(null);

  // Compute turn timing slots (approx 45s per turn if not provided)
  const turnDurations = useMemo(() => {
    return turns.map((turn, index) => {
      const start = turn.timestampStartSec ?? index * 45;
      const end = turn.timestampEndSec ?? (index + 1) * 45;
      return { turnNumber: turn.turnNumber, start, end, duration: end - start };
    });
  }, [turns]);

  const totalDurationSec = useMemo(() => {
    return turnDurations.length > 0 ? turnDurations[turnDurations.length - 1].end : 180;
  }, [turnDurations]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Playback loop
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTimeSec(prev => {
          const next = prev + 0.25 * playbackSpeed;
          if (next >= totalDurationSec) {
            return totalDurationSec;
          }
          return next;
        });
      }, 250);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, totalDurationSec]);

  // Sync active turn from current time
  useEffect(() => {
    const matchedSlot = turnDurations.find(
      slot => currentTimeSec >= slot.start && currentTimeSec < slot.end,
    );
    if (matchedSlot) {
      setActiveTurnNumber(matchedSlot.turnNumber);
    } else if (currentTimeSec >= totalDurationSec && turnDurations.length > 0) {
      setActiveTurnNumber(turnDurations[turnDurations.length - 1].turnNumber);
      setIsPlaying(false);
    }
  }, [currentTimeSec, turnDurations, totalDurationSec]);

  const handleTogglePlay = () => {
    if (currentTimeSec >= totalDurationSec) {
      setCurrentTimeSec(0);
      setActiveTurnNumber(1);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (timeSec: number) => {
    setCurrentTimeSec(Math.max(0, Math.min(totalDurationSec, timeSec)));
  };

  const handleSeekToTurn = (turnNum: number) => {
    const slot = turnDurations.find(s => s.turnNumber === turnNum);
    if (slot) {
      setCurrentTimeSec(slot.start);
      setActiveTurnNumber(turnNum);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTimeSec(0);
    setActiveTurnNumber(1);
  };

  const cycleSpeed = () => {
    const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIdx]);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const getScoreVariant = (score?: number): 'success' | 'warning' | 'danger' | 'outline' => {
    if (score === undefined || score === null) return 'outline';
    if (score >= 7.5) return 'success';
    if (score >= 5.0) return 'warning';
    return 'danger';
  };

  return (
    <div
      className={`rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4 bg-gray-50/70 dark:bg-gray-950/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {language === 'vi' ? 'Interactive Timeline Replay' : 'Interactive Timeline Replay'}
              <Badge variant="info">Studio View</Badge>
            </h3>
            <p className="text-xs text-gray-500">
              {language === 'vi'
                ? 'Phát lại toàn bộ buổi phỏng vấn đồng bộ câu hỏi, câu trả lời và đánh giá'
                : 'Synchronized replay of audio, candidate responses, and real-time rubrics'}
            </p>
          </div>
        </div>

        {overallScore !== undefined && (
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500 font-medium">
              {language === 'vi' ? 'Điểm tổng:' : 'Overall Score:'}
            </span>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              {formatScore(overallScore)}/10
            </span>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-gray-800">
        {/* Left / Top: Interactive Turns List (Karaoke feed) */}
        <div className="lg:col-span-7 p-6 space-y-4 max-h-[500px] overflow-y-auto">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            <span>{language === 'vi' ? 'Danh sách Lượt phỏng vấn' : 'Interview Turns'}</span>
            <span>
              {turns.length} {language === 'vi' ? 'lượt' : 'turns'}
            </span>
          </div>

          {turns.map((turn, index) => {
            const isActive = turn.turnNumber === activeTurnNumber;
            const slot = turnDurations[index];
            const scoreVar = getScoreVariant(turn.score);

            return (
              <div
                key={turn.turnNumber}
                onClick={() => handleSeekToTurn(turn.turnNumber)}
                className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-sm ring-1 ring-indigo-500/20'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      Turn {turn.turnNumber}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {formatTime(slot.start)} - {formatTime(slot.end)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {turn.score !== undefined && (
                      <Badge variant={scoreVar}>{formatScore(turn.score)}/10</Badge>
                    )}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedTurnForDetail(
                          selectedTurnForDetail === turn.turnNumber ? null : turn.turnNumber,
                        );
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 ml-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      {language === 'vi' ? 'Gợi ý' : 'Model Answer'}
                    </button>
                  </div>
                </div>

                {/* Question snippet */}
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 line-clamp-2 mb-1.5">
                  Q: {turn.questionContent}
                </p>

                {/* Candidate Answer */}
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800/60 text-xs text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
                  <span className="font-semibold text-gray-500 mr-1.5">A:</span>
                  {turn.answerText || (
                    <span className="italic text-gray-400">
                      {language === 'vi' ? 'Không có câu trả lời' : 'No response'}
                    </span>
                  )}
                </div>

                {/* Expanded Model Answer & Rubric tips */}
                {selectedTurnForDetail === turn.turnNumber && turn.modelAnswer && (
                  <div className="mt-3 p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs space-y-2 animate-fadeIn">
                    <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                      <Lightbulb className="w-4 h-4" />
                      {language === 'vi'
                        ? 'Câu trả lời mẫu tối ưu (Model Answer):'
                        : 'Optimal Model Answer:'}
                    </div>
                    <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {turn.modelAnswer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right / Bottom: Current Turn Rubric Deep-Dive */}
        <div className="lg:col-span-5 p-6 space-y-5 bg-gray-50/40 dark:bg-gray-950/20 max-h-[500px] overflow-y-auto">
          {(() => {
            const currentActive = turns.find(t => t.turnNumber === activeTurnNumber);
            if (!currentActive) return null;

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {language === 'vi'
                      ? `Chi tiết đánh giá Turn ${currentActive.turnNumber}`
                      : `Turn ${currentActive.turnNumber} Rubric Analysis`}
                  </h4>
                  {currentActive.score !== undefined && (
                    <Badge variant={getScoreVariant(currentActive.score)}>
                      {formatScore(currentActive.score)}/10
                    </Badge>
                  )}
                </div>

                {/* 3 Rubric Dimension Bars */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-gray-600 dark:text-gray-400">
                        {language === 'vi' ? 'Độ chính xác kỹ thuật' : 'Technical Accuracy (40%)'}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {formatScore(currentActive.technicalScore ?? currentActive.score ?? 0)}/10
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{
                          width: `${((currentActive.technicalScore ?? currentActive.score ?? 0) / 10) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-gray-600 dark:text-gray-400">
                        {language === 'vi' ? 'Độ sâu kiến trúc' : 'Depth & Tradeoffs (30%)'}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {formatScore(currentActive.depthScore ?? currentActive.score ?? 0)}/10
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full"
                        style={{
                          width: `${((currentActive.depthScore ?? currentActive.score ?? 0) / 10) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-gray-600 dark:text-gray-400">
                        {language === 'vi' ? 'Khả năng diễn đạt' : 'Clarity & Structure (30%)'}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {formatScore(currentActive.clarityScore ?? currentActive.score ?? 0)}/10
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${((currentActive.clarityScore ?? currentActive.score ?? 0) / 10) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Key Strengths */}
                {currentActive.strengths && currentActive.strengths.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {language === 'vi' ? 'Điểm mạnh ghi nhận:' : 'Strengths Noted:'}
                    </span>
                    <ul className="space-y-1 pl-2">
                      {currentActive.strengths.map((st, i) => (
                        <li
                          key={i}
                          className="text-xs text-gray-700 dark:text-gray-300 list-disc list-inside"
                        >
                          {st}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Areas for Improvement */}
                {currentActive.improvements && currentActive.improvements.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {language === 'vi' ? 'Điểm cần cải thiện:' : 'Areas to Improve:'}
                    </span>
                    <ul className="space-y-1 pl-2">
                      {currentActive.improvements.map((imp, i) => (
                        <li
                          key={i}
                          className="text-xs text-gray-700 dark:text-gray-300 list-disc list-inside"
                        >
                          {imp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Playback Control Bar Footer */}
      <div className="p-4 bg-gray-900 text-white border-t border-gray-800 flex flex-col gap-3">
        {/* Timeline Slider with Turn Markers */}
        <div className="space-y-1.5">
          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={totalDurationSec}
              step={0.5}
              value={currentTimeSec}
              onChange={e => handleSeek(parseFloat(e.target.value))}
              aria-label="Timeline seek slider"
              aria-valuetext={`${formatTime(currentTimeSec)} of ${formatTime(totalDurationSec)}`}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <div className="flex justify-between text-[11px] font-mono text-gray-400">
            <span>{formatTime(currentTimeSec)}</span>
            <span>{formatTime(totalDurationSec)}</span>
          </div>
        </div>

        {/* Buttons & Speed controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleTogglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              data-testid="play-toggle-btn"
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full w-9 h-9 p-0 flex items-center justify-center"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              aria-label="Reset"
              data-testid="reset-btn"
              className="text-gray-400 hover:text-white p-1.5"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            <button
              type="button"
              onClick={cycleSpeed}
              aria-label="Playback speed"
              className="text-xs font-mono px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
            >
              {playbackSpeed}x
            </button>
          </div>

          <div className="text-xs text-gray-400 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {language === 'vi' ? 'Lượt hiện tại:' : 'Active Turn:'}{' '}
            <span className="font-bold text-white">Turn {activeTurnNumber}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
