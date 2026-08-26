import { CompetencyBreakdownItemDto } from '@ai-interview/contracts';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface CompetencyBreakdownTableProps {
  items: CompetencyBreakdownItemDto[];
}

export function CompetencyBreakdownTable({ items }: CompetencyBreakdownTableProps) {
  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
        No competency breakdown data available.
      </div>
    );
  }

  const getStatusBadge = (status: 'TARGET_MET' | 'APPROACHING' | 'BELOW_TARGET') => {
    switch (status) {
      case 'TARGET_MET':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Target Met
          </span>
        );
      case 'APPROACHING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Clock className="w-3 h-3" />
            Approaching
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3 h-3" />
            Below Target
          </span>
        );
    }
  };

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
      data-testid="competency-breakdown-table"
    >
      <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Role-Weighted Competency Fulfillment
        </span>
        <span className="text-[11px] text-slate-500">
          Formula: R = Σ (w_i × min(S_i / T_i, 1.0))
        </span>
      </div>

      <div className="divide-y divide-slate-100 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/40 text-slate-500 font-semibold uppercase text-[10px]">
            <tr>
              <th className="py-2.5 px-4">Competency Area</th>
              <th className="py-2.5 px-3">Role Weight</th>
              <th className="py-2.5 px-3">Current Score</th>
              <th className="py-2.5 px-3">Fulfillment</th>
              <th className="py-2.5 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => (
              <tr key={item.area} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-3 px-4 font-semibold text-slate-900">
                  {item.name}
                  {item.estimatedWeeksToTarget !== null && item.estimatedWeeksToTarget > 0 && (
                    <span className="block text-[10px] text-slate-400 font-normal">
                      ~{item.estimatedWeeksToTarget} wks to target
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-slate-600 font-mono">
                  {(item.weight * 100).toFixed(0)}%
                </td>
                <td className="py-3 px-3 font-semibold text-slate-800">
                  {item.currentScore.toFixed(1)}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">
                    / {item.targetScore.toFixed(1)}
                  </span>
                </td>
                <td className="py-3 px-3 w-48">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-700">
                      <span>{item.fulfillmentPercentage.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          item.fulfillmentPercentage >= 95
                            ? 'bg-emerald-500'
                            : item.fulfillmentPercentage >= 80
                              ? 'bg-indigo-500'
                              : 'bg-amber-500'
                        }`}
                        style={{ width: `${item.fulfillmentPercentage}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-right">{getStatusBadge(item.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
