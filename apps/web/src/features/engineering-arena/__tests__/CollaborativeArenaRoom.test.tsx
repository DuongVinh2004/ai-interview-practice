import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollaborativeArenaRoomPage } from '../CollaborativeArenaRoomPage';
import { useArenaCollaborativeRoom } from '../useArenaCollaborativeRoom';
import { ArenaCollaborativeRole, ArenaRunStatus } from '@ai-interview/contracts';

// Mock the hook
vi.mock('../useArenaCollaborativeRoom', () => ({
  useArenaCollaborativeRoom: vi.fn(),
}));

describe('CollaborativeArenaRoomPage (3.3 Multiplayer / Mentor Room)', () => {
  const mockSendCursorMove = vi.fn();
  const mockSendCodeChange = vi.fn();
  const mockSendRunTests = vi.fn();
  const mockLeaveRoom = vi.fn();

  const defaultMockState = {
    isConnected: true,
    presence: {
      roomId: 'room-alpha-123',
      hostUserId: 'user-alice-1',
      activeFile: 'src/solution.ts',
      updatedAt: '2026-10-27T10:00:00.000Z',
      participants: [
        {
          socketId: 'sock-1',
          userId: 'user-alice-1',
          displayName: 'Candidate Alice',
          role: ArenaCollaborativeRole.HOST,
          color: '#10B981',
          joinedAt: '2026-10-27T09:59:00.000Z',
        },
        {
          socketId: 'sock-2',
          userId: 'user-bob-mentor',
          displayName: 'Mentor Bob',
          avatarUrl: 'https://example.com/bob.jpg',
          role: ArenaCollaborativeRole.MENTOR,
          color: '#8B5CF6',
          joinedAt: '2026-10-27T10:00:00.000Z',
        },
      ],
    },
    participants: [
      {
        socketId: 'sock-1',
        userId: 'user-alice-1',
        displayName: 'Candidate Alice',
        role: ArenaCollaborativeRole.HOST,
        color: '#10B981',
        joinedAt: '2026-10-27T09:59:00.000Z',
      },
      {
        socketId: 'sock-2',
        userId: 'user-bob-mentor',
        displayName: 'Mentor Bob',
        avatarUrl: 'https://example.com/bob.jpg',
        role: ArenaCollaborativeRole.MENTOR,
        color: '#8B5CF6',
        joinedAt: '2026-10-27T10:00:00.000Z',
      },
    ],
    remoteCursors: {
      'user-bob-mentor': {
        userId: 'user-bob-mentor',
        displayName: 'Mentor Bob',
        role: ArenaCollaborativeRole.MENTOR,
        color: '#8B5CF6',
        file: 'src/solution.ts',
        line: 12,
        column: 8,
        timestamp: 1729000000,
      },
    },
    activeCode: {
      'src/solution.ts': 'export function solve(input: string) {\n  return input.trim();\n}',
    },
    sharedTestRun: null,
    error: null,
    sendCursorMove: mockSendCursorMove,
    sendCodeChange: mockSendCodeChange,
    sendRunTests: mockSendRunTests,
    leaveRoom: mockLeaveRoom,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useArenaCollaborativeRoom as any).mockReturnValue(defaultMockState);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders room header with presence list and role badges', () => {
    render(
      <CollaborativeArenaRoomPage
        roomId="room-alpha-123"
        userRole={ArenaCollaborativeRole.HOST}
        currentUserId="user-alice-1"
      />,
    );

    expect(screen.getByText(/Live Collaborative Arena/i)).toBeInTheDocument();
    expect(screen.getByText('room-alpha-123')).toBeInTheDocument();
    expect(screen.getByText('Candidate Alice')).toBeInTheDocument();
    expect(screen.getByText('Mentor Bob')).toBeInTheDocument();
    expect(screen.getByText('HOST')).toBeInTheDocument();
    expect(screen.getByText('MENTOR')).toBeInTheDocument();
  });

  it('displays mentor avatar and cursor indicator in the editor view', () => {
    render(
      <CollaborativeArenaRoomPage
        roomId="room-alpha-123"
        userRole={ArenaCollaborativeRole.HOST}
        currentUserId="user-alice-1"
      />,
    );

    // Mentor Bob's cursor position indicator
    expect(screen.getByTestId('cursor-user-bob-mentor')).toBeInTheDocument();
    expect(screen.getByText('Mentor Bob (L12:C8)')).toBeInTheDocument();
  });

  it('enforces read-only indicator and disables editor when user is MENTOR', () => {
    (useArenaCollaborativeRoom as any).mockReturnValue({
      ...defaultMockState,
    });

    render(
      <CollaborativeArenaRoomPage
        roomId="room-alpha-123"
        userRole={ArenaCollaborativeRole.MENTOR}
        currentUserId="user-bob-mentor"
      />,
    );

    expect(screen.getByText(/Observer Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Read-only for mentors/i)).toBeInTheDocument();

    const editorTextarea = screen.getByLabelText('Collaborative Code Editor');
    expect(editorTextarea).toHaveAttribute('readonly');
  });

  it('broadcasts code changes when candidate edits code', () => {
    render(
      <CollaborativeArenaRoomPage
        roomId="room-alpha-123"
        userRole={ArenaCollaborativeRole.HOST}
        currentUserId="user-alice-1"
      />,
    );

    const editorTextarea = screen.getByLabelText('Collaborative Code Editor');
    fireEvent.change(editorTextarea, {
      target: { value: 'export function solve() { return 100; }' },
    });

    expect(mockSendCodeChange).toHaveBeenCalledWith(
      'src/solution.ts',
      'export function solve() { return 100; }',
    );
  });

  it('triggers shared test run when Run Tests button is pressed by Host', () => {
    render(
      <CollaborativeArenaRoomPage
        roomId="room-alpha-123"
        userRole={ArenaCollaborativeRole.HOST}
        currentUserId="user-alice-1"
      />,
    );

    const runTestsBtn = screen.getByRole('button', { name: /Run Tests/i });
    fireEvent.click(runTestsBtn);

    expect(mockSendRunTests).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: 'test',
        status: ArenaRunStatus.RUNNING,
      }),
    );
  });

  it('displays live shared execution stream and test pass/fail results', () => {
    (useArenaCollaborativeRoom as any).mockReturnValue({
      ...defaultMockState,
      sharedTestRun: {
        roomId: 'room-alpha-123',
        triggeredBy: {
          userId: 'user-alice-1',
          displayName: 'Candidate Alice',
          role: ArenaCollaborativeRole.HOST,
        },
        commandId: 'test',
        status: ArenaRunStatus.PASSED,
        stdout: 'PASS src/solution.test.ts (4 tests passed)',
        stderr: '',
        durationMs: 412,
        testsTotal: 4,
        testsPassed: 4,
        testsFailed: 0,
        testResults: [
          {
            suiteName: 'solution.test.ts',
            testName: 'should trim input',
            passed: true,
            durationMs: 100,
          },
        ],
        timestamp: 1729000010,
      },
    });

    render(
      <CollaborativeArenaRoomPage
        roomId="room-alpha-123"
        userRole={ArenaCollaborativeRole.MENTOR}
        currentUserId="user-bob-mentor"
      />,
    );

    expect(screen.getByText(/4 \/ 4 Passed/i)).toBeInTheDocument();
    expect(screen.getByText(/PASS src\/solution.test.ts/i)).toBeInTheDocument();
    expect(screen.getByText('should trim input')).toBeInTheDocument();
  });
});
