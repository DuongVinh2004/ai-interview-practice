import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useFocusModeStore } from '../stores/focus-mode.store';
import { ArenaWorkspaceView } from '../features/engineering-arena/ArenaWorkspaceView';
import { useEngineeringArena } from '../features/engineering-arena/useEngineeringArena';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Focus Mode Hotkey (Task 2.3)', () => {
  beforeEach(() => {
    useFocusModeStore.setState({ isFocusMode: false });
    useEngineeringArena.setState({
      session: {
        id: 'session-hotkey-test',
        userId: 'user-123',
        challengeSlug: 'test-challenge',
        challengeTitle: 'Test Challenge',
        challengeDomain: 'BACKEND' as any,
        challengeCategory: 'REFACTORING' as any,
        state: 'ACTIVE' as any,
        sandboxMode: 'DETERMINISTIC' as any,
        aiAssistanceMode: 'HINTS_ONLY' as any,
        files: [
          {
            path: 'src/main.ts',
            name: 'main.ts',
            isDirectory: false,
            isEditable: true,
          },
        ],
        initialFileContents: {
          'src/main.ts': 'console.log("hello");',
        },
        startedAt: new Date().toISOString(),
      },
      fileContents: {
        'src/main.ts': 'console.log("hello");',
      },
      activeFilePath: 'src/main.ts',
    });
  });

  it('toggles focus mode on keydown "F" when not focusing input/textarea/contenteditable', () => {
    renderWithProviders(<ArenaWorkspaceView />);
    expect(useFocusModeStore.getState().isFocusMode).toBe(false);

    // Fire keydown F on window
    fireEvent.keyDown(window, { key: 'f' });
    expect(useFocusModeStore.getState().isFocusMode).toBe(true);

    // Fire keydown Escape to turn off focus mode
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useFocusModeStore.getState().isFocusMode).toBe(false);
  });

  it('turns off focus mode on keydown Escape when currently in focus mode', () => {
    useFocusModeStore.setState({ isFocusMode: true });
    renderWithProviders(<ArenaWorkspaceView />);
    expect(useFocusModeStore.getState().isFocusMode).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useFocusModeStore.getState().isFocusMode).toBe(false);
  });

  it('does NOT toggle focus mode on keydown "F" when focused inside input or textarea', () => {
    renderWithProviders(<ArenaWorkspaceView />);
    expect(useFocusModeStore.getState().isFocusMode).toBe(false);

    const textarea = screen.getByLabelText('Code Editor');
    textarea.focus();

    fireEvent.keyDown(textarea, { key: 'f' });
    expect(useFocusModeStore.getState().isFocusMode).toBe(false);

    fireEvent.keyDown(textarea, { key: 'F' });
    expect(useFocusModeStore.getState().isFocusMode).toBe(false);
  });
});
