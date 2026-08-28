import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChallengeCatalogView } from '../features/engineering-arena/ChallengeCatalogView';
import { ArenaEvaluationReportModal } from '../features/engineering-arena/ArenaEvaluationReportModal';
import { ArenaCopilotChatPanel } from '../features/engineering-arena/ArenaCopilotChatPanel';
import { ChallengeDomain, ChallengeCategory } from '@ai-interview/contracts';

// Mock useEngineeringArena hook
const mockFetchChallenges = vi.fn();
const mockStartSession = vi.fn();

vi.mock('../features/engineering-arena/useEngineeringArena', () => ({
  useEngineeringArena: () => ({
    challenges: [
      {
        id: 'c1',
        slug: 'fix-memory-leak',
        title: 'Fix Memory Leak in EventEmitter',
        domain: ChallengeDomain.BACKEND,
        category: ChallengeCategory.BUG_FIX,
        difficulty: 3,
        estimatedMinutes: 30,
        status: 'PUBLISHED',
        activeVersion: 1,
        createdAt: '2026-08-28T00:00:00.000Z',
        updatedAt: '2026-08-28T00:00:00.000Z',
      },
    ],
    isLoading: false,
    error: null,
    fetchChallenges: mockFetchChallenges,
    startSession: mockStartSession,
  }),
}));

describe('Engineering Arena Web Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ChallengeCatalogView', () => {
    it('renders challenge list and handles challenge selection', () => {
      const handleSelect = vi.fn();
      render(<ChallengeCatalogView onSelectChallenge={handleSelect} />);

      expect(screen.getByText('Engineering Arena')).toBeInTheDocument();
      expect(screen.getByText('Fix Memory Leak in EventEmitter')).toBeInTheDocument();
      expect(screen.getByText('Difficulty 3/5')).toBeInTheDocument();

      const startBtn = screen.getByRole('button', { name: /Start Challenge/i });
      fireEvent.click(startBtn);
      expect(handleSelect).toHaveBeenCalledWith('fix-memory-leak');
    });

    it('triggers fetchChallenges on domain filter change', () => {
      render(<ChallengeCatalogView onSelectChallenge={vi.fn()} />);

      const domainSelect = screen.getByLabelText('Filter by domain');
      fireEvent.change(domainSelect, { target: { value: ChallengeDomain.BACKEND } });
      expect(mockFetchChallenges).toHaveBeenCalled();
    });

    it('switches to Skill Radar tab when clicked', () => {
      render(<ChallengeCatalogView onSelectChallenge={vi.fn()} />);

      const radarTabBtn = screen.getByRole('button', { name: /Skill Radar/i });
      fireEvent.click(radarTabBtn);

      expect(screen.getByText('Engineering Skill Radar & Mastery Growth')).toBeInTheDocument();
      expect(screen.getByText('Security & Auth (BOLA, JWT)')).toBeInTheDocument();
    });
  });

  describe('ArenaEvaluationReportModal', () => {
    const mockEvaluation = {
      id: 'e1',
      sessionId: 's1',
      submissionId: 'sub-1',
      scoreBreakdown: {
        objectiveScore: 85,
        rubricScore: 90,
        finalScore: 87,
        scoreCapApplied: false,
        testsVisiblePassed: 4,
        testsVisibleTotal: 4,
        testsHiddenPassed: 3,
        testsHiddenTotal: 3,
      },
      aiFeedbackSummary: 'Great fix for memory leak.',
      rubricCriteriaFeedback: [
        {
          key: 'cleanup',
          name: 'Resource Cleanup',
          score: 45,
          maxPoints: 50,
          feedback: 'Event listener removed successfully.',
        },
      ],
      skillEvidences: [
        {
          taxonomyKey: 'nodejs_memory',
          evidenceType: 'CHALLENGE_EVALUATION',
          scoreContribution: 87,
          confidence: 0.95,
          sourceSummary: 'Passed all tests',
        },
      ],
      evaluatedAt: '2026-08-28T00:00:00.000Z',
    };

    it('renders score breakdown, rubric feedback and handles close', () => {
      const handleClose = vi.fn();
      render(
        <ArenaEvaluationReportModal
          isOpen={true}
          evaluation={mockEvaluation}
          onClose={handleClose}
        />,
      );

      expect(screen.getByText('Engineering Arena Assessment Report')).toBeInTheDocument();
      expect(screen.getByText('87')).toBeInTheDocument();
      expect(screen.getByText('4 / 4')).toBeInTheDocument();
      expect(screen.getByText('3 / 3')).toBeInTheDocument();
      expect(screen.getByText('Resource Cleanup')).toBeInTheDocument();
      expect(screen.getByText('nodejs_memory')).toBeInTheDocument();

      const closeBtn = screen.getByRole('button', { name: /Done/i });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalled();
    });

    it('displays score cap alert if scoreCapApplied is true', () => {
      const cappedEval = {
        ...mockEvaluation,
        scoreBreakdown: {
          ...mockEvaluation.scoreBreakdown,
          finalScore: 40,
          scoreCapApplied: true,
          scoreCapReason: 'Visible tests failed.',
        },
      };

      render(
        <ArenaEvaluationReportModal isOpen={true} evaluation={cappedEval} onClose={vi.fn()} />,
      );

      expect(screen.getByText('Score Cap Applied')).toBeInTheDocument();
      expect(screen.getByText('Visible tests failed.')).toBeInTheDocument();
    });
  });

  describe('ArenaCopilotChatPanel', () => {
    it('renders chat messages and sends user queries', async () => {
      const mockAsk = vi.fn().mockResolvedValue({
        answer: 'Check the ownership validation logic in controller.',
        mode: 'HINTS_ONLY',
      });
      const handleClose = vi.fn();

      render(
        <ArenaCopilotChatPanel
          isOpen={true}
          onClose={handleClose}
          onAskCopilot={mockAsk}
          isAsking={false}
        />,
      );

      expect(screen.getByText('AI Copilot')).toBeInTheDocument();
      expect(screen.getByText(/Hello! I am your AI Engineering Copilot/i)).toBeInTheDocument();

      const input = screen.getByPlaceholderText('Ask Copilot...');
      fireEvent.change(input, { target: { value: 'How do I fix BOLA?' } });

      const sendBtn = screen.getByRole('button', { name: /Send/i });
      fireEvent.click(sendBtn);

      expect(mockAsk).toHaveBeenCalledWith('How do I fix BOLA?');

      await waitFor(() => {
        expect(
          screen.getByText('Check the ownership validation logic in controller.'),
        ).toBeInTheDocument();
      });
    });

    it('handles quick action hint click', () => {
      render(
        <ArenaCopilotChatPanel
          isOpen={true}
          onClose={vi.fn()}
          onAskCopilot={vi.fn()}
          isAsking={false}
        />,
      );

      const hintBtn = screen.getByRole('button', { name: /Request hint/i });
      fireEvent.click(hintBtn);

      const input = screen.getByPlaceholderText('Ask Copilot...') as HTMLInputElement;
      expect(input.value).toContain('architectural hint');
    });
  });
});
