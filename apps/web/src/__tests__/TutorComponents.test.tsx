import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SocraticTutorDrawer } from '../components/tutor/SocraticTutorDrawer';
import { InstantRetryModal } from '../components/tutor/InstantRetryModal';
import { TutorRatingButtons } from '../components/tutor/TutorRatingButtons';
import { TutorRole } from '@ai-interview/contracts';

describe('Socratic AI Tutor & Instant Retry Components (F006)', () => {
  it('renders SocraticTutorDrawer with message history, references, and sends new message', () => {
    const onSendMessage = vi.fn().mockResolvedValue(undefined);
    const onRate = vi.fn().mockResolvedValue({ success: true });
    const onClose = vi.fn();

    const mockMessages = [
      {
        id: 'msg-1',
        role: TutorRole.AI_TUTOR,
        content: 'What happens when two concurrent transactions update the same row?',
        references: [
          { title: 'PostgreSQL Concurrency Control', url: 'https://postgresql.org/docs' },
        ],
      },
      {
        id: 'msg-2',
        role: TutorRole.USER,
        content: 'A lock is acquired and the second transaction waits.',
      },
    ];

    render(
      <SocraticTutorDrawer
        isOpen={true}
        onClose={onClose}
        turnNumber={1}
        questionContent="Explain database locking"
        messages={mockMessages}
        isStreaming={false}
        streamedContent=""
        onSendMessage={onSendMessage}
        onRate={onRate}
      />,
    );

    expect(screen.getByTestId('socratic-tutor-drawer')).toBeInTheDocument();
    expect(screen.getByText(/AI Socratic Tutor/i)).toBeInTheDocument();
    expect(screen.getByText(/What happens when two concurrent transactions/i)).toBeInTheDocument();
    expect(screen.getByText(/PostgreSQL Concurrency Control/i)).toBeInTheDocument();
    expect(
      screen.getByText('A lock is acquired and the second transaction waits.'),
    ).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Hỏi AI Tutor thêm về khái niệm/i);
    fireEvent.change(input, { target: { value: 'How does optimistic locking differ?' } });

    const sendBtn = screen.getByTestId('tutor-send-btn');
    fireEvent.click(sendBtn);

    expect(onSendMessage).toHaveBeenCalledWith('How does optimistic locking differ?');
  });

  it('renders InstantRetryModal and computes score delta after submission', async () => {
    const onSubmitRetry = vi.fn().mockResolvedValue({
      retryId: 'retry-1',
      interviewId: 'int-1',
      turnNumber: 1,
      originalAnswer: 'Use mutex.',
      retryAnswer: 'Use distributed locks with Redlock algorithm and TTL.',
      originalScore: 5.0,
      retryScore: 8.5,
      improvement: 3.5,
      feedback: {
        summary: 'Excellent improvement with clear architectural reasoning.',
        keyStrengths: ['Proper failure isolation', 'TTL safeguard'],
        remainingGaps: [],
      },
    });

    const onClose = vi.fn();

    render(
      <InstantRetryModal
        isOpen={true}
        onClose={onClose}
        interviewId="int-1"
        turnNumber={1}
        questionContent="How do you handle distributed locks?"
        originalAnswer="Use mutex."
        originalScore={5.0}
        onSubmitRetry={onSubmitRetry}
        isSubmitting={false}
      />,
    );

    expect(screen.getByTestId('instant-retry-modal')).toBeInTheDocument();
    expect(screen.getByText(/Luyện tập lại Câu hỏi #1/i)).toBeInTheDocument();
    expect(screen.getByText('"Use mutex."')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Gõ chi tiết câu trả lời mới/i);
    fireEvent.change(textarea, {
      target: { value: 'Use distributed locks with Redlock algorithm and TTL.' },
    });

    const submitBtn = screen.getByText(/Chấm điểm câu trả lời mới/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitRetry).toHaveBeenCalledWith(
        'Use distributed locks with Redlock algorithm and TTL.',
      );
      expect(screen.getByText(/Điểm số sau khi cải thiện/i)).toBeInTheDocument();
    });
  });

  it('renders TutorRatingButtons and registers thumbs up feedback', async () => {
    const onRate = vi.fn().mockResolvedValue({ success: true });

    render(<TutorRatingButtons onRate={onRate} />);

    expect(screen.getByTestId('tutor-rating-buttons')).toBeInTheDocument();

    const thumbsUpBtn = screen.getByTitle('Hữu ích');
    fireEvent.click(thumbsUpBtn);

    await waitFor(() => {
      expect(onRate).toHaveBeenCalledWith('UP');
      expect(screen.getByText('Cảm ơn đánh giá của bạn!')).toBeInTheDocument();
    });
  });
});
