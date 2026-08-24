import { useState } from 'react';
import { ChevronRight, ChevronDown, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import { SkillGraphNodeDto } from '@ai-interview/contracts';

interface SkillTreeItemProps {
  node: SkillGraphNodeDto;
  level?: number;
}

export function SkillTreeNodeItem({ node, level = 1 }: SkillTreeItemProps) {
  const [isOpen, setIsOpen] = useState(level < 2);
  const hasChildren = Boolean(node.children && node.children.length > 0);

  const getScoreColor = (score: number) => {
    if (score >= 8.0) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 6.0) return 'text-indigo-700 bg-indigo-50 border-indigo-200';
    if (score >= 4.0) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const scoreColor = getScoreColor(node.score);
  const percent = Math.min(100, Math.round((node.score / 10) * 100));

  return (
    <div className="select-none">
      <div
        onClick={() => hasChildren && setIsOpen(!isOpen)}
        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
          level === 1
            ? 'bg-white border-slate-200 hover:border-emerald-300 shadow-sm mb-2'
            : level === 2
            ? 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/80 mb-1.5'
            : 'bg-white border-dashed border-slate-200 mb-1 hover:bg-emerald-50/30'
        } ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
        style={{ marginLeft: `${(level - 1) * 16}px` }}
      >
        <div className="flex items-center gap-2.5">
          {hasChildren ? (
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
              onClick={e => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
            >
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-6 h-6 flex items-center justify-center">
              {node.score >= 7.5 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-slate-300" />
              )}
            </span>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span
                className={`font-semibold text-slate-900 ${
                  level === 1 ? 'text-sm' : level === 2 ? 'text-xs' : 'text-xs'
                }`}
              >
                {node.name}
              </span>
              {node.nameVi && <span className="text-[10px] text-slate-400">({node.nameVi})</span>}
            </div>
            {node.evidenceCount > 0 && (
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {node.evidenceCount} evaluated sample{node.evidenceCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="w-24 hidden sm:block">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  node.score >= 8.0
                    ? 'bg-emerald-500'
                    : node.score >= 6.0
                    ? 'bg-indigo-500'
                    : node.score >= 4.0
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <span
            className={`text-xs font-bold px-2 py-0.5 rounded border ${scoreColor} min-w-[42px] text-center`}
          >
            {node.score.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isOpen && (
        <div className="space-y-1 pl-2 border-l-2 border-slate-100 my-1">
          {node.children!.map(child => (
            <SkillTreeNodeItem key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

interface SkillTreeViewProps {
  nodes: SkillGraphNodeDto[];
}

export function SkillTreeView({ nodes }: SkillTreeViewProps) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs">
        <ShieldAlert className="w-6 h-6 mx-auto mb-2 text-slate-400" />
        No skills taxonomy loaded yet.
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="skill-tree-view">
      {nodes.map(node => (
        <SkillTreeNodeItem key={node.id} node={node} level={node.level || 1} />
      ))}
    </div>
  );
}
