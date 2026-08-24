import { useState } from 'react';
import { InterviewTurnDto } from '@ai-interview/contracts';
import { formatScore, formatDifficulty } from '../../lib/utils';
import { useI18nStore } from '../../stores/i18n.store';
import { RubricBreakdown } from './RubricBreakdown';
import { ChevronDown, ChevronUp, CheckCircle2, Award, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

interface TurnHistoryAccordionProps {
  turns: InterviewTurnDto[];
  currentTurnNumber: number;
  onReEvaluate?: (turnNumber: number) => void;
  isReEvaluating?: boolean;
}

export function TurnHistoryAccordion({
  turns,
  currentTurnNumber,
  onReEvaluate,
  isReEvaluating,
}: TurnHistoryAccordionProps) {
  const { t } = useI18nStore();
  const [expandedTurn, setExpandedTurn] = useState<number | null>(null);

  const completedPastTurns = turns.filter(
    turn => turn.turnNumber < currentTurnNumber && turn.answer?.evaluation,
  );

  if (completedPastTurns.length === 0) {
    return null;
  }

  const toggleTurn = (turnNum: number) => {
    setExpandedTurn(expandedTurn === turnNum ? null : turnNum);
  };

  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
        <span>{t.interview.pastTurns}</span>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
          {completedPastTurns.length}
        </span>
      </h3>

      <div className="space-y-2">
        {completedPastTurns.map(turn => {
          const isExpanded = expandedTurn === turn.turnNumber;
          const evaluation = turn.answer?.evaluation;
          const diffInfo = formatDifficulty(turn.difficulty);

          return (
            <div
              key={turn.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm transition-all"
            >
              {/* Accordion Header */}
              <button
                type="button"
                onClick={() => toggleTurn(turn.turnNumber)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {t.interview.question} {turn.turnNumber}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${diffInfo.color}`}>
                        {diffInfo.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                      {turn.question?.content}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {evaluation && (
                    <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full font-bold text-xs">
                      <Award className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{formatScore(evaluation.score)}/10</span>
                    </div>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Accordion Body */}
              {isExpanded && (
                <div className="p-4 border-t border-slate-100 bg-slate-50/40 space-y-4 text-xs">
                  <div>
                    <h4 className="font-bold text-slate-700 mb-1">{t.interview.question}</h4>
                    <p className="text-slate-800 bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap">
                      {turn.question?.content}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-700 mb-1">{t.interview.submittedAnswer}</h4>
                    <p className="text-slate-800 bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap">
                      {turn.answer?.content}
                    </p>
                  </div>

                  {evaluation && (
                    <div className="space-y-3 pt-1">
                      <h4 className="font-bold text-slate-700">{t.interview.feedbackTitle}</h4>
                      <RubricBreakdown scores={evaluation.rubricScores as any} />

                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-slate-700 italic">"{evaluation.conciseFeedback}"</p>
                      </div>

                      {onReEvaluate && (
                        <div className="flex justify-end pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onReEvaluate(turn.turnNumber)}
                            isLoading={isReEvaluating}
                            className="gap-1.5 text-emerald-700 hover:text-emerald-800"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>{t.interview.requestReEvaluation}</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
