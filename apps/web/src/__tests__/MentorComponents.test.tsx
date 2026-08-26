import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiCoPilotHintPanel } from '../features/mentor/components/AiCoPilotHintPanel';
import { ScoreOverrideModal } from '../features/mentor/components/ScoreOverrideModal';
import { MentorAvailabilityPage } from '../features/mentor/MentorAvailabilityPage';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Track F012: Mentor Co-Pilot Frontend Components', () => {
  it('renders AiCoPilotHintPanel with live probing feed banner', () => {
    render(<AiCoPilotHintPanel sessionId="session-test-123" onSelectHint={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('copilot-hint-panel')).toBeInTheDocument();
    expect(screen.getByText('AI Mentor Co-Pilot')).toBeInTheDocument();
  });

  it('renders ScoreOverrideModal with original score and justification input', () => {
    render(
      <ScoreOverrideModal
        isOpen={true}
        onClose={vi.fn()}
        evaluationId="eval-123"
        originalScore={6.5}
        onSuccess={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId('score-override-modal')).toBeInTheDocument();
    expect(screen.getByText('Override AI Evaluation Score')).toBeInTheDocument();
    expect(screen.getByText('6.5 / 10.0')).toBeInTheDocument();
    expect(screen.getByTestId('override-score-input')).toBeInTheDocument();
    expect(screen.getByTestId('override-justification-input')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-override-btn')).toBeInTheDocument();
  });

  it('renders MentorAvailabilityPage with weekly slot manager and save button', () => {
    render(<MentorAvailabilityPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('mentor-availability-page')).toBeInTheDocument();
    expect(screen.getByText(/Mentor Profile & Weekly Availability/i)).toBeInTheDocument();
    expect(screen.getByTestId('add-slot-btn')).toBeInTheDocument();
    expect(screen.getByTestId('save-availability-btn')).toBeInTheDocument();
  });
});
