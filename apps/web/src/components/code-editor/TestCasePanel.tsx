import React, { useState } from 'react';
import { TestCaseExecutionResult } from '@ai-interview/contracts';
import { CheckCircle2, XCircle, ListChecks } from 'lucide-react';

interface TestCasePanelProps {
  testResults?: TestCaseExecutionResult[];
}

export const TestCasePanel: React.FC<TestCasePanelProps> = ({ testResults = [] }) => {
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0);

  if (!testResults || testResults.length === 0) {
    return (
      <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 font-mono text-xs flex items-center space-x-2">
        <ListChecks className="w-4 h-4 text-slate-500" />
        <span>
          No test cases evaluated yet. Hit &quot;Run Code&quot; to test your implementation.
        </span>
      </div>
    );
  }

  const currentCase = testResults[selectedCaseIdx] || testResults[0];

  return (
    <div
      className="flex flex-col bg-slate-900 border border-slate-700 rounded-lg overflow-hidden font-mono text-xs"
      data-testid="test-case-panel"
    >
      {/* Test Case Tabs */}
      <div className="flex items-center space-x-1 p-1.5 bg-slate-800 border-b border-slate-700 overflow-x-auto">
        {testResults.map((tc, idx) => {
          const isSelected = idx === selectedCaseIdx;
          return (
            <button
              key={idx}
              onClick={() => setSelectedCaseIdx(idx)}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition-colors ${
                isSelected
                  ? 'bg-slate-700 text-white font-medium border border-slate-600'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tc.passed ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              ) : (
                <XCircle className="w-3 h-3 text-rose-400" />
              )}
              <span>Case {idx + 1}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Test Case Detail */}
      {currentCase && (
        <div className="p-3 bg-slate-950 space-y-2">
          <div>
            <div className="text-slate-500 font-semibold mb-1">Input:</div>
            <div className="bg-slate-900 p-2 rounded text-slate-200 border border-slate-800">
              {currentCase.input}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-slate-500 font-semibold mb-1">Expected Output:</div>
              <div className="bg-slate-900 p-2 rounded text-emerald-400 border border-slate-800">
                {currentCase.expectedOutput}
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-semibold mb-1">Actual Output:</div>
              <div
                className={`bg-slate-900 p-2 rounded border border-slate-800 ${currentCase.passed ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {currentCase.actualOutput ||
                  (currentCase.errorMsg ? `Error: ${currentCase.errorMsg}` : 'None')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
