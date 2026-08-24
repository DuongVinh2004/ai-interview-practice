import { CheckCircle2, Circle } from 'lucide-react';

interface MilestoneItem {
  type: string;
  targetScore: number;
  achieved: boolean;
  achievedAt?: string | null;
}

interface MilestoneTimelineProps {
  milestones: MilestoneItem[];
}

export function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3" data-testid="milestone-timeline">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Offer Readiness Milestones
        </span>
        <span className="text-[11px] text-slate-500">
          {milestones.filter(m => m.achieved).length} of {milestones.length} Completed
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2 pt-2">
        {milestones.map(m => (
          <div
            key={m.type}
            className={`p-2.5 rounded-xl border text-center transition-all ${
              m.achieved
                ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 shadow-xs'
                : 'bg-slate-50/60 border-slate-200 text-slate-400'
            }`}
          >
            <div className="flex justify-center mb-1">
              {m.achieved ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <Circle className="w-5 h-5 text-slate-300" />
              )}
            </div>

            <div className="text-xs font-bold">{m.type} Ready</div>
            <span className="text-[10px] block text-slate-500 mt-0.5">
              {m.achieved
                ? m.achievedAt
                  ? new Date(m.achievedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Achieved'
                : 'Pending'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
