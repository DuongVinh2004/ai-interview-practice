import React from 'react';
import { ArenaEvaluationResponse } from '@ai-interview/contracts';

interface ArenaEvaluationReportModalProps {
  isOpen: boolean;
  evaluation: ArenaEvaluationResponse | null;
  onClose: () => void;
}

export const ArenaEvaluationReportModal: React.FC<ArenaEvaluationReportModalProps> = ({
  isOpen,
  evaluation,
  onClose,
}) => {
  if (!isOpen || !evaluation) return null;

  const { scoreBreakdown, rubricCriteriaFeedback, skillEvidences, aiFeedbackSummary } = evaluation;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="evaluation-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
              Evaluation Completed
            </span>
            <h2
              id="evaluation-modal-title"
              className="text-2xl font-bold text-slate-900 dark:text-white mt-1"
            >
              Engineering Arena Assessment Report
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close evaluation modal"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg focus:outline-none"
          >
            ✕
          </button>
        </div>

        {/* Score Warning Alert if Capped */}
        {scoreBreakdown.scoreCapApplied && (
          <div className="mt-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
            <div className="font-semibold mb-1">Score Cap Applied</div>
            <p>{scoreBreakdown.scoreCapReason}</p>
          </div>
        )}

        {/* Score Dial & Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
          <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Final Score
            </span>
            <span className="text-4xl font-extrabold text-primary-600 dark:text-primary-400 mt-1">
              {scoreBreakdown.finalScore}
              <span className="text-lg font-normal text-slate-400">/100</span>
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Visible Tests
            </span>
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-1">
              {scoreBreakdown.testsVisiblePassed} / {scoreBreakdown.testsVisibleTotal}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Hidden Tests
            </span>
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-1">
              {scoreBreakdown.testsHiddenPassed} / {scoreBreakdown.testsHiddenTotal}
            </span>
          </div>
        </div>

        {/* AI Feedback Summary */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
            AI Engineering Review
          </h3>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300">
            {aiFeedbackSummary}
          </div>
        </div>

        {/* Rubric Criteria Breakdown */}
        {rubricCriteriaFeedback.length > 0 && (
          <div className="mb-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
              Rubric Criteria Feedback
            </h3>
            <div className="space-y-3">
              {rubricCriteriaFeedback.map(crit => (
                <div
                  key={crit.key}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                      {crit.name}
                    </span>
                    <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                      {crit.score} / {crit.maxPoints} pts
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{crit.feedback}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skill Graph Delta Evidences */}
        {skillEvidences.length > 0 && (
          <div className="mb-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
              Skill Graph Evidence Recorded
            </h3>
            <div className="space-y-2">
              {skillEvidences.map((evidence, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
                    {evidence.taxonomyKey}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    +{evidence.scoreContribution}% mastery contribution
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-5 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
