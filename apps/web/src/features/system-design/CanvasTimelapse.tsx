import { CanvasSnapshotDto } from '@ai-interview/contracts';
import { History, Play, Pause } from 'lucide-react';
import { useState, useEffect } from 'react';

interface CanvasTimelapseProps {
  snapshots: CanvasSnapshotDto[];
  activeIdx: number | null;
  onSelectSnapshot: (idx: number | null) => void;
}

export function CanvasTimelapse({
  snapshots,
  activeIdx,
  onSelectSnapshot,
}: CanvasTimelapseProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && snapshots.length > 0) {
      interval = setInterval(() => {
        const next = (activeIdx ?? -1) + 1;
        if (next >= snapshots.length) {
          setIsPlaying(false);
          onSelectSnapshot(null); // Return to live
        } else {
          onSelectSnapshot(next);
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, snapshots.length, activeIdx, onSelectSnapshot]);

  if (!snapshots || snapshots.length === 0) {
    return null;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2.5" data-testid="canvas-timelapse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Time-Lapse Replay ({snapshots.length} snapshots)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md hover:bg-emerald-100"
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isPlaying ? 'Pause' : 'Play Replay'}</span>
          </button>

          {activeIdx !== null && (
            <button
              type="button"
              onClick={() => onSelectSnapshot(null)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 underline"
            >
              Return to Live
            </button>
          )}
        </div>
      </div>

      {/* Snapshot step buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onSelectSnapshot(null)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
            activeIdx === null
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          ● Live Canvas
        </button>

        {snapshots.map((snap, idx) => (
          <button
            key={snap.id || idx}
            type="button"
            onClick={() => onSelectSnapshot(idx)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all ${
              activeIdx === idx
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Snapshot {idx + 1} ({formatTime(snap.elapsedSeconds)})
          </button>
        ))}
      </div>
    </div>
  );
}
