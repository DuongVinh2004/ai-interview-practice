import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TimelineReplayPlayer, TurnReplayData } from '../features/history/TimelineReplayPlayer';

describe('TimelineReplayPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  const mockTurns: TurnReplayData[] = [
    {
      turnNumber: 1,
      questionContent: 'Explain Database Indexing mechanisms in PostgreSQL.',
      answerText: 'PostgreSQL uses B-Tree indexes as default, providing logarithmic lookup time.',
      score: 8.5,
      technicalScore: 8.8,
      depthScore: 8.2,
      clarityScore: 8.5,
      strengths: ['Correct B-Tree complexity', 'Mentioned WAL considerations'],
      improvements: ['Could mention GIN/GiST indexes'],
      modelAnswer:
        'PostgreSQL default is B-tree index, alongside BRIN, GiST, SP-GiST, GIN, and Hash.',
      timestampStartSec: 0,
      timestampEndSec: 45,
    },
    {
      turnNumber: 2,
      questionContent: 'How do you handle distributed transactions across microservices?',
      answerText: 'We can use the Saga pattern with compensating transactions.',
      score: 7.8,
      technicalScore: 8.0,
      depthScore: 7.5,
      clarityScore: 8.0,
      strengths: ['Clear understanding of Saga pattern'],
      improvements: ['Discuss outbox pattern or idempotency key'],
      timestampStartSec: 45,
      timestampEndSec: 90,
    },
  ];

  it('renders interactive timeline replay with all turns and score badges', () => {
    render(
      <TimelineReplayPlayer turns={mockTurns} overallScore={8.2} roleTitle="Backend Architect" />,
    );

    expect(screen.getByText(/Interactive Timeline Replay/i)).toBeInTheDocument();
    expect(screen.getByText(/Studio View/i)).toBeInTheDocument();
    expect(screen.getByText(/Explain Database Indexing mechanisms/i)).toBeInTheDocument();
    expect(screen.getByText(/How do you handle distributed transactions/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Turn 1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Turn 2/i).length).toBeGreaterThan(0);
  });

  it('toggles play and fast-forwards playback timer', () => {
    render(<TimelineReplayPlayer turns={mockTurns} overallScore={8.2} />);

    const playBtn = screen.getByTestId('play-toggle-btn');
    fireEvent.click(playBtn);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText(/Active Turn|Lượt hiện tại/i)).toBeInTheDocument();
  });

  it('switches speed and expands model answer on click', () => {
    render(<TimelineReplayPlayer turns={mockTurns} overallScore={8.2} />);

    // Speed button
    const speedBtn = screen.getByText('1x');
    fireEvent.click(speedBtn);
    expect(screen.getByText('1.25x')).toBeInTheDocument();

    // Model answer trigger
    const modelAnswerBtns = screen.getAllByText(/Model Answer|Gợi ý/i);
    fireEvent.click(modelAnswerBtns[0]);

    expect(screen.getByText(/Optimal Model Answer|Câu trả lời mẫu tối ưu/i)).toBeInTheDocument();
  });
});
