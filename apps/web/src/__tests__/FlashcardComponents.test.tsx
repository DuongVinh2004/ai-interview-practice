import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlashcardItem } from '../components/flashcards/FlashcardItem';
import { StreakHeatmap } from '../components/flashcards/StreakHeatmap';
import { CreateCardModal } from '../components/flashcards/CreateCardModal';
import { CardType } from '@ai-interview/contracts';

describe('Flashcard & Spaced Repetition Components (F005)', () => {
  it('renders FlashcardItem and flips on click', () => {
    const onFlip = vi.fn();

    const { rerender } = render(
      <FlashcardItem
        front="What is the CAP Theorem?"
        back="Consistency, Availability, Partition tolerance."
        type={CardType.CONCEPT}
        isFlipped={false}
        onFlip={onFlip}
      />
    );

    expect(screen.getByTestId('flashcard-item')).toBeInTheDocument();
    expect(screen.getByText('What is the CAP Theorem?')).toBeInTheDocument();
    expect(screen.getByText('Mặt trước (Câu hỏi)')).toBeInTheDocument();

    const card = screen.getByTestId('flashcard-item');
    fireEvent.click(card);
    expect(onFlip).toHaveBeenCalled();

    // Rerender as flipped
    rerender(
      <FlashcardItem
        front="What is the CAP Theorem?"
        back="Consistency, Availability, Partition tolerance."
        type={CardType.CONCEPT}
        isFlipped={true}
        onFlip={onFlip}
      />
    );

    expect(screen.getByText('Consistency, Availability, Partition tolerance.')).toBeInTheDocument();
    expect(screen.getByText('Mặt sau (Đáp án)')).toBeInTheDocument();
  });

  it('renders StreakHeatmap with current streak, longest streak, and total reviews', () => {
    const mockStreak = {
      currentStreak: 7,
      longestStreak: 14,
      lastReviewDate: '2026-08-24',
      totalReviews: 88,
    };

    const mockHeatmap = [
      { date: '2026-08-24', count: 12 },
      { date: '2026-08-23', count: 5 },
    ];

    render(<StreakHeatmap streak={mockStreak} heatmap={mockHeatmap} />);

    expect(screen.getByTestId('streak-heatmap')).toBeInTheDocument();
    expect(screen.getByText(/7 ngày liên tiếp/i)).toBeInTheDocument();
    expect(screen.getByText(/Kỷ lục: 14 ngày/i)).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
  });

  it('renders CreateCardModal and submits new flashcard data', () => {
    const onCreateCard = vi.fn().mockResolvedValue({ id: 'card-1' });
    const onClose = vi.fn();

    render(
      <CreateCardModal
        isOpen={true}
        onClose={onClose}
        deckId="deck-123"
        onCreateCard={onCreateCard}
        isSubmitting={false}
      />
    );

    expect(screen.getByTestId('create-card-modal')).toBeInTheDocument();
    expect(screen.getByText('Thêm Flashcard Mới')).toBeInTheDocument();

    const frontInput = screen.getByPlaceholderText(/Điều gì xảy ra khi một Node.js/i);
    const backInput = screen.getByPlaceholderText(/Toàn bộ single-threaded/i);

    fireEvent.change(frontInput, { target: { value: 'Explain idempotency in REST APIs' } });
    fireEvent.change(backInput, { target: { value: 'Making multiple identical requests has the same effect as a single request.' } });

    const submitBtn = screen.getByText('Tạo Flashcard');
    fireEvent.click(submitBtn);

    expect(onCreateCard).toHaveBeenCalledWith({
      deckId: 'deck-123',
      type: CardType.CONCEPT,
      frontContent: 'Explain idempotency in REST APIs',
      backContent: 'Making multiple identical requests has the same effect as a single request.',
    });
  });
});
