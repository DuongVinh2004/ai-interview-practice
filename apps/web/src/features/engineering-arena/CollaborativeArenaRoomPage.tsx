import React, { useState } from 'react';
import { useParams, useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { ArenaCollaborativeRole, ArenaRunStatus } from '@ai-interview/contracts';
import { useArenaCollaborativeRoom } from './useArenaCollaborativeRoom';

export interface CollaborativeArenaRoomPageProps {
  roomId: string;
  userRole?: ArenaCollaborativeRole;
  currentUserId?: string;
  onLeave?: () => void;
}

export const CollaborativeArenaRoomPage: React.FC<CollaborativeArenaRoomPageProps> = ({
  roomId,
  userRole = ArenaCollaborativeRole.HOST,
  currentUserId,
  onLeave,
}) => {
  const [activeFile, setActiveFile] = useState<string>('src/solution.ts');

  const {
    isConnected,
    presence,
    participants,
    remoteCursors,
    activeCode,
    sharedTestRun,
    error,
    sendCursorMove,
    sendCodeChange,
    sendRunTests,
    leaveRoom,
  } = useArenaCollaborativeRoom({
    roomId,
    role: userRole,
    initialFiles: {
      'src/solution.ts':
        '// Live Collaborative Arena Workspace\nexport function solve() {\n  return true;\n}\n',
    },
  });

  const isMentor = userRole === ArenaCollaborativeRole.MENTOR;
  const currentCode = activeCode[activeFile] || '';

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isMentor) return;
    const newContent = e.target.value;
    sendCodeChange(activeFile, newContent);
  };

  const handleCursorSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart);
    const lines = textBeforeCursor.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    sendCursorMove(activeFile, line, column);
  };

  const handleTriggerRunTests = () => {
    sendRunTests({
      commandId: 'test',
      status: ArenaRunStatus.RUNNING,
      stdout: 'Executing tests in sandbox runner...',
      durationMs: 0,
    });
  };

  const handleExit = () => {
    leaveRoom();
    if (onLeave) onLeave();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-900 text-slate-100">
      {/* Top Header / Presence Bar */}
      <header className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
              title={isConnected ? 'Connected' : 'Disconnected'}
            />
            <h1 className="text-base font-bold text-white tracking-wide">
              Live Collaborative Arena
            </h1>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
            {roomId}
          </span>
          {isMentor && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700">
              Observer Mode (Read-only for mentors)
            </span>
          )}
        </div>

        {/* Presence Avatars & Role Badges */}
        <div className="flex items-center gap-3">
          {presence?.hostUserId && (
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Host: <span className="text-slate-200 font-mono">{presence.hostUserId}</span>
            </span>
          )}
          <div className="flex items-center -space-x-1 overflow-hidden">
            {participants.map(p => {
              const isMe = currentUserId && p.userId === currentUserId;
              return (
                <div
                  key={p.socketId || p.userId}
                  className="relative inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border bg-slate-800 border-slate-700"
                  style={{ borderLeftColor: p.color, borderLeftWidth: '3px' }}
                  title={`${p.displayName} (${p.role})${isMe ? ' - You' : ''}`}
                >
                  <span className="font-semibold text-slate-200">
                    {p.displayName}
                    {isMe && <span className="text-slate-400 font-normal"> (You)</span>}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                      p.role === ArenaCollaborativeRole.HOST
                        ? 'bg-emerald-950 text-emerald-400'
                        : p.role === ArenaCollaborativeRole.MENTOR
                          ? 'bg-purple-950 text-purple-400'
                          : 'bg-blue-950 text-blue-400'
                    }`}
                  >
                    {p.role}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleExit}
            className="text-xs px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
          >
            Leave Room
          </button>
        </div>
      </header>

      {/* Error Notification */}
      {error && (
        <div className="px-4 py-2 bg-rose-950/80 border-b border-rose-800 text-rose-300 text-xs flex items-center justify-between">
          <span>
            <strong>Error ({error.code}):</strong> {error.message}
          </span>
        </div>
      )}

      {/* Workspace Area: Left Editor + Right Shared Test Stream */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Column */}
        <div className="flex-1 flex flex-col border-r border-slate-800">
          {/* File Tabs */}
          <div className="flex items-center px-4 py-2 bg-slate-950 border-b border-slate-800 text-xs gap-2 overflow-x-auto">
            {Object.keys(activeCode).map(filePath => (
              <button
                key={filePath}
                onClick={() => setActiveFile(filePath)}
                className={`px-3 py-1 rounded font-mono font-medium transition ${
                  activeFile === filePath
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filePath}
              </button>
            ))}
          </div>

          {/* Active Remote Cursors Floating Overlay */}
          <div className="relative flex-1 flex flex-col bg-slate-900">
            {Object.values(remoteCursors).map(cursor => (
              <div
                key={cursor.userId}
                data-testid={`cursor-${cursor.userId}`}
                className="absolute z-10 pointer-events-none flex items-center gap-1 px-2 py-0.5 rounded shadow text-[11px] font-mono text-white transition-all duration-150"
                style={{
                  backgroundColor: cursor.color || '#8B5CF6',
                  top: `${Math.min(cursor.line * 20, 400)}px`,
                  left: `${Math.min(cursor.column * 8, 300)}px`,
                }}
              >
                <span>
                  {cursor.displayName} (L{cursor.line}:C{cursor.column})
                </span>
              </div>
            ))}

            <textarea
              aria-label="Collaborative Code Editor"
              value={currentCode}
              onChange={handleCodeChange}
              onSelect={handleCursorSelection}
              onKeyUp={handleCursorSelection}
              onClick={handleCursorSelection}
              readOnly={isMentor}
              className={`w-full flex-1 p-4 font-mono text-sm bg-slate-900 text-slate-100 resize-none outline-none focus:ring-0 ${
                isMentor ? 'opacity-80 cursor-not-allowed' : ''
              }`}
              placeholder="// Write code here..."
              spellCheck={false}
            />
          </div>
        </div>

        {/* Right Column: Shared Test Execution Stream */}
        <div className="w-96 flex flex-col bg-slate-950">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Shared Execution Stream
            </h2>
            <button
              onClick={handleTriggerRunTests}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow transition"
            >
              Run Tests
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
            {!sharedTestRun ? (
              <div className="text-slate-500 text-center py-8">
                No active test runs. Click &quot;Run Tests&quot; to execute shared suite.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Triggered by:</span>
                  <span className="font-semibold text-white">
                    {sharedTestRun.triggeredBy.displayName} ({sharedTestRun.triggeredBy.role})
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Status:</span>
                  <span
                    className={`font-bold uppercase ${
                      sharedTestRun.status === ArenaRunStatus.PASSED
                        ? 'text-emerald-400'
                        : sharedTestRun.status === ArenaRunStatus.FAILED
                          ? 'text-rose-400'
                          : 'text-amber-400'
                    }`}
                  >
                    {sharedTestRun.status}
                  </span>
                </div>

                {sharedTestRun.testsTotal > 0 && (
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="flex justify-between font-bold text-slate-200 mb-1">
                      <span>Test Summary:</span>
                      <span className="text-emerald-400">
                        {sharedTestRun.testsPassed} / {sharedTestRun.testsTotal} Passed
                      </span>
                    </div>
                  </div>
                )}

                {sharedTestRun.stdout && (
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-slate-300 whitespace-pre-wrap">
                    {sharedTestRun.stdout}
                  </div>
                )}

                {sharedTestRun.testResults && sharedTestRun.testResults.length > 0 && (
                  <div className="space-y-1 mt-2">
                    <span className="text-[11px] text-slate-400 font-semibold uppercase">
                      Test Suite Details:
                    </span>
                    {sharedTestRun.testResults.map((t, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800/80 text-[11px]"
                      >
                        <span className="text-slate-300 truncate">{t.testName}</span>
                        <span
                          className={`font-bold ${t.passed ? 'text-emerald-400' : 'text-rose-400'}`}
                        >
                          {t.passed ? 'PASS' : 'FAIL'} ({t.durationMs}ms)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const CollaborativeArenaRoomRoute: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const roleParam = searchParams.get('role')?.toUpperCase();
  const role =
    roleParam === 'MENTOR'
      ? ArenaCollaborativeRole.MENTOR
      : roleParam === 'PAIR_CODER'
        ? ArenaCollaborativeRole.PAIR_CODER
        : ArenaCollaborativeRole.HOST;

  if (!roomId) {
    return <Navigate to="/arena" replace />;
  }

  return (
    <CollaborativeArenaRoomPage
      roomId={roomId}
      userRole={role}
      currentUserId={user?.id}
      onLeave={() => navigate('/arena')}
    />
  );
};

export default CollaborativeArenaRoomPage;
