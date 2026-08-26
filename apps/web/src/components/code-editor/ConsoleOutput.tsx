import React from 'react';
import { ExecuteCodeResponse, SubmissionStatus } from '@ai-interview/contracts';
import { Terminal, CheckCircle2, XCircle, Clock, Cpu } from 'lucide-react';

interface ConsoleOutputProps {
  result: ExecuteCodeResponse | null;
  isLoading?: boolean;
}

export const ConsoleOutput: React.FC<ConsoleOutputProps> = ({ result, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 font-mono text-xs flex items-center space-x-2">
        <Terminal className="w-4 h-4 animate-pulse text-primary-400" />
        <span>Executing in isolated sandbox...</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg text-slate-500 font-mono text-xs flex items-center space-x-2">
        <Terminal className="w-4 h-4 text-slate-500" />
        <span>Run code to inspect STDOUT, STDERR, and execution metrics.</span>
      </div>
    );
  }

  const isSuccess = result.status === SubmissionStatus.COMPLETED && result.allPassed;

  return (
    <div
      className="flex flex-col bg-slate-900 border border-slate-700 rounded-lg overflow-hidden font-mono text-xs"
      data-testid="console-output"
    >
      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center space-x-2">
          {isSuccess ? (
            <span className="flex items-center text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> All Tests Passed
            </span>
          ) : (
            <span className="flex items-center text-rose-400 font-semibold">
              <XCircle className="w-3.5 h-3.5 mr-1" /> Status: {result.status}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-slate-400">
          {result.executionTimeMs !== undefined && (
            <span className="flex items-center">
              <Clock className="w-3 h-3 mr-1" /> {result.executionTimeMs}ms
            </span>
          )}
          {result.memoryUsageKb != null && (
            <span className="flex items-center">
              <Cpu className="w-3 h-3 mr-1" /> {(result.memoryUsageKb / 1024).toFixed(1)}MB
            </span>
          )}
        </div>
      </div>

      {/* Output Content */}
      <div className="p-3 bg-slate-950 text-slate-200 max-h-48 overflow-y-auto space-y-2 whitespace-pre-wrap">
        {result.stdout && (
          <div>
            <div className="text-slate-500 font-semibold">STDOUT:</div>
            <div className="text-slate-100">{result.stdout}</div>
          </div>
        )}
        {result.stderr && (
          <div>
            <div className="text-rose-400 font-semibold">STDERR:</div>
            <div className="text-rose-300">{result.stderr}</div>
          </div>
        )}
        {result.compileError && (
          <div>
            <div className="text-rose-400 font-semibold">Compilation Error:</div>
            <div className="text-rose-300">{result.compileError}</div>
          </div>
        )}
      </div>
    </div>
  );
};
