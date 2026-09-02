import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChallengeCatalogView } from '../features/engineering-arena/ChallengeCatalogView';
import { ArenaEvaluationReportModal } from '../features/engineering-arena/ArenaEvaluationReportModal';
import { ArenaSkillRadarView } from '../features/engineering-arena/ArenaSkillRadarView';
import { ArenaCopilotChatPanel } from '../features/engineering-arena/ArenaCopilotChatPanel';
import { ArenaEvaluationResponse } from '@ai-interview/contracts';

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

describe('Engineering Arena Web Components (F017)', () => {
  it('renders ChallengeCatalogView with header and filter dropdowns', () => {
    const onSelect = vi.fn();
    renderWithProviders(<ChallengeCatalogView onSelectChallenge={onSelect} />);

    expect(screen.getByText('Engineering Arena')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by domain')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by category')).toBeInTheDocument();
  });

  it('switches between Challenges catalog and Skill Radar tab in ChallengeCatalogView', () => {
    const onSelect = vi.fn();
    renderWithProviders(<ChallengeCatalogView onSelectChallenge={onSelect} />);

    const radarTabBtn = screen.getByRole('button', { name: /Skill Radar/i });
    fireEvent.click(radarTabBtn);

    expect(screen.getByText(/Engineering Skill Radar & Mastery Growth/i)).toBeInTheDocument();
  });

  it('renders ArenaSkillRadarView with mastery progress and recommendation card', () => {
    const onSelectRecommended = vi.fn();
    renderWithProviders(<ArenaSkillRadarView onSelectRecommendedChallenge={onSelectRecommended} />);

    expect(screen.getByText(/Security & Auth \(BOLA, JWT\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Concurrency & Race Invariants/i)).toBeInTheDocument();
    expect(screen.getByText(/Recommended Focus/i)).toBeInTheDocument();

    const startBtn = screen.getByRole('button', { name: /Start Recommended Challenge/i });
    fireEvent.click(startBtn);
    expect(onSelectRecommended).toHaveBeenCalledWith('optimize-graphql-n-plus-one');
  });

  it('renders ArenaEvaluationReportModal with score breakdown and rubric criteria', () => {
    const mockEvaluation: ArenaEvaluationResponse = {
      id: 'eval-1',
      sessionId: 'sess-1',
      submissionId: 'sub-1',
      scoreBreakdown: {
        objectiveScore: 85,
        rubricScore: 90,
        finalScore: 87,
        scoreCapApplied: false,
        scoreCapReason: null,
        testsVisiblePassed: 4,
        testsVisibleTotal: 4,
        testsHiddenPassed: 3,
        testsHiddenTotal: 3,
      },
      aiFeedbackSummary: 'Excellent solution adhering to security invariants.',
      rubricCriteriaFeedback: [
        {
          key: 'sec-auth',
          name: 'Authorization Invariant',
          score: 28,
          maxPoints: 30,
          feedback: 'Correctly verified session userId ownership.',
        },
      ],
      skillEvidences: [
        {
          taxonomyKey: 'security.bola',
          evidenceType: 'ARENA_CHALLENGE_EVALUATION',
          scoreContribution: 87,
          confidence: 0.95,
          sourceSummary: 'Verified BOLA mitigation.',
        },
      ],
      evaluatedAt: new Date().toISOString(),
    };

    const onClose = vi.fn();
    renderWithProviders(
      <ArenaEvaluationReportModal isOpen={true} evaluation={mockEvaluation} onClose={onClose} />,
    );

    expect(screen.getByText('Engineering Arena Assessment Report')).toBeInTheDocument();
    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.getByText('4 / 4')).toBeInTheDocument();
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByText('Authorization Invariant')).toBeInTheDocument();
    expect(
      screen.getByText('Excellent solution adhering to security invariants.'),
    ).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close evaluation modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders ArenaEvaluationReportModal with score cap alert when capped', () => {
    const mockCappedEvaluation: ArenaEvaluationResponse = {
      id: 'eval-2',
      sessionId: 'sess-2',
      submissionId: 'sub-2',
      scoreBreakdown: {
        objectiveScore: 30,
        rubricScore: 80,
        finalScore: 40,
        scoreCapApplied: true,
        scoreCapReason: 'Visible unit tests failed. Score is capped at 40%.',
        testsVisiblePassed: 1,
        testsVisibleTotal: 4,
        testsHiddenPassed: 0,
        testsHiddenTotal: 3,
      },
      aiFeedbackSummary: 'Unit tests failed.',
      rubricCriteriaFeedback: [],
      skillEvidences: [],
      evaluatedAt: new Date().toISOString(),
    };

    renderWithProviders(
      <ArenaEvaluationReportModal
        isOpen={true}
        evaluation={mockCappedEvaluation}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Score Cap Applied')).toBeInTheDocument();
    expect(
      screen.getByText('Visible unit tests failed. Score is capped at 40%.'),
    ).toBeInTheDocument();
  });

  it('renders ArenaCopilotChatPanel, sends question, and receives response', async () => {
    const onAskCopilot = vi.fn().mockResolvedValue({
      answer: 'Check the repository user session ownership verification.',
      mode: 'HINTS_ONLY',
    });
    const onClose = vi.fn();

    renderWithProviders(
      <ArenaCopilotChatPanel
        isOpen={true}
        onClose={onClose}
        onAskCopilot={onAskCopilot}
        isAsking={false}
      />,
    );

    expect(screen.getByText(/AI Copilot/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Ask Copilot\.\.\./i);
    const sendBtn = screen.getByRole('button', { name: /Send/i });

    fireEvent.change(input, { target: { value: 'How do I fix BOLA in this controller?' } });
    fireEvent.click(sendBtn);

    expect(onAskCopilot).toHaveBeenCalledWith('How do I fix BOLA in this controller?');

    await waitFor(() => {
      expect(
        screen.getByText('Check the repository user session ownership verification.'),
      ).toBeInTheDocument();
    });
  });
});
