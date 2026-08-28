import React, { useState } from 'react';
import { useEngineeringArena } from './useEngineeringArena';
import { ArenaEvaluationReportModal } from './ArenaEvaluationReportModal';
import { ArenaCopilotChatPanel } from './ArenaCopilotChatPanel';

interface ArenaWorkspaceViewProps {
  onBackToCatalog?: () => void;
}

export const ArenaWorkspaceView: React.FC<ArenaWorkspaceViewProps> = ({
  onBackToCatalog,
}) => {
  const {
    session,
    fileContents,
    activeFilePath,
    latestRun,
    evaluation,
    isRunningCommand,
    isSubmitting,
    isAskingCopilot,
    updateFileContent,
    setActiveFilePath,
    runCommand,
    submitSolution,
    askCopilot,
  } = useEngineeringArena();

  const [explanation, setExplanation] = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">No active workspace</h2>
        <p className="text-sm text-slate-500 mt-2">Select a challenge from the catalog to start practicing.</p>
        {onBackToCatalog && (
          <button
            onClick={onBackToCatalog}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700"
          >
            Go to Catalog
          </button>
        )}
      </div>
    );
  }

  const activeContent = activeFilePath ? fileContents[activeFilePath] || '' : '';
  const currentFileNode = session.files.find((f) => f.path === activeFilePath);

  const handleSubmit = async () => {
    setShowSubmitConfirm(false);
    await submitSolution(explanation);
    setShowReportModal(true);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-900 text-slate-100">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {onBackToCatalog && (
            <button
              onClick={onBackToCatalog}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded"
            >
              ← Catalog
            </button>
          )}
          <div>
            <span className="text-xs text-primary-400 font-semibold uppercase">{session.challengeDomain}</span>
            <h1 className="text-sm font-bold text-white truncate max-w-md">{session.challengeTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCopilot((prev) => !prev)}
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              showCopilot
                ? 'bg-primary-600 text-white border-primary-500'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
          >
            🤖 AI Copilot
          </button>

          <button
            onClick={() => runCommand('test')}
            disabled={isRunningCommand || isSubmitting}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50"
          >
            {isRunningCommand ? 'Running Tests...' : '▶ Run Tests'}
          </button>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={isRunningCommand || isSubmitting}
            className="inline-flex items-center px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Evaluating...' : '✓ Submit Solution'}
          </button>
        </div>
      </div>

      {/* Main Workspace Layout (Sidebar + Editor + Output Console + Copilot Panel) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: File Tree */}
        <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
          <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
            Files
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {session.files.map((file) => (
              <button
                key={file.path}
                onClick={() => setActiveFilePath(file.path)}
                className={`w-full text-left px-4 py-1.5 text-xs flex items-center justify-between transition-colors ${
                  activeFilePath === file.path
                    ? 'bg-primary-950/60 text-primary-400 font-semibold border-l-2 border-primary-500'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <span className="truncate">{file.path}</span>
                {file.isEditable && (
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-1 rounded">edit</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Code Editor Area */}
        <div className="flex-1 flex flex-col bg-slate-900 border-r border-slate-800">
          <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800 text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>{activeFilePath || 'No file selected'}</span>
            <span>{currentFileNode?.isEditable ? 'Read / Write' : 'Read Only'}</span>
          </div>

          <div className="flex-1 p-2">
            <textarea
              aria-label="Code Editor"
              value={activeContent}
              readOnly={!currentFileNode?.isEditable}
              onChange={(e) => {
                if (activeFilePath && currentFileNode?.isEditable) {
                  updateFileContent(activeFilePath, e.target.value);
                }
              }}
              className="w-full h-full p-4 font-mono text-sm bg-slate-900 text-slate-100 border-0 focus:outline-none resize-none"
              placeholder="// Select an editable file from the file tree..."
            />
          </div>
        </div>

        {/* Right / Bottom: Test Runner Output Console */}
        <div className="w-96 bg-slate-950 flex flex-col border-r border-slate-800">
          <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Execution Terminal</span>
            {latestRun && (
              <span className={latestRun.status === 'PASSED' ? 'text-emerald-400' : 'text-rose-400'}>
                {latestRun.status}
              </span>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 bg-slate-950 whitespace-pre-wrap">
            {latestRun ? (
              <>
                <div className="text-slate-500 mb-2">// Exit code: {latestRun.exitCode} | Duration: {latestRun.durationMs}ms</div>
                <div>{latestRun.stdout}</div>
                {latestRun.stderr && <div className="text-rose-400 mt-2">{latestRun.stderr}</div>}
              </>
            ) : (
              <div className="text-slate-600 italic">
                Click "Run Tests" to execute the test suite in an isolated sandbox.
              </div>
            )}
          </div>
        </div>

        {/* Slide-out AI Copilot Chat Panel */}
        <ArenaCopilotChatPanel
          isOpen={showCopilot}
          onClose={() => setShowCopilot(false)}
          onAskCopilot={askCopilot}
          isAsking={isAskingCopilot}
        />
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2">Submit Solution for Evaluation?</h3>
            <p className="text-xs text-slate-400 mb-4">
              Your final code will be snapshot and verified against visible and hidden test suites.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Explanation / Approach Notes (Optional)
              </label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none"
                placeholder="Explain the root cause and the architectural reasoning behind your fix..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded"
              >
                Confirm & Evaluate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Report Modal */}
      <ArenaEvaluationReportModal
        isOpen={showReportModal}
        evaluation={evaluation}
        onClose={() => setShowReportModal(false)}
      />
    </div>
  );
};
