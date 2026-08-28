import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QuestionCard } from '../features/question-bank/components/QuestionCard';
import { PaywallModal } from '../features/question-bank/components/PaywallModal';
import { QuestionFilterSidebar } from '../features/question-bank/components/QuestionFilterSidebar';
import { FeedbackModal } from '../features/question-bank/components/FeedbackModal';
import { QuestionPublicationStatus } from '@ai-interview/contracts';

describe('Question Bank Web Components', () => {
  const mockQuestion: any = {
    id: 'q-test-1',
    slug: 'distributed-cache-design',
    title: 'Thiết kế hệ thống Distributed Cache với Redis',
    questionBody: 'Làm thế nào để tránh cache avalanche và cache stampede trong hệ thống lớn?',
    questionType: 'system_design',
    difficulty: 4,
    language: 'vi',
    status: QuestionPublicationStatus.PUBLISHED,
    createdById: 'author-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobRole: { id: 'role-1', slug: 'backend', name: 'Backend Engineer' },
    technologies: [{ id: 'tech-1', slug: 'redis', name: 'Redis' }],
    isBookmarked: false,
    isRevealed: false,
    previewAvailable: true,
  };

  it('QuestionCard renders title, body, difficulty and handles bookmark click', () => {
    const handleBookmark = vi.fn();

    render(
      <BrowserRouter>
        <QuestionCard question={mockQuestion} onToggleBookmark={handleBookmark} />
      </BrowserRouter>,
    );

    expect(screen.getByText('Thiết kế hệ thống Distributed Cache với Redis')).toBeInTheDocument();
    expect(screen.getByText(/Làm thế nào để tránh cache avalanche/i)).toBeInTheDocument();
    expect(screen.getByText('Khó (L4)')).toBeInTheDocument();
    expect(screen.getByText('Thiết kế hệ thống')).toBeInTheDocument();
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
    expect(screen.getByText('Chưa mở đáp án')).toBeInTheDocument();

    const bookmarkBtn = screen.getByRole('button', { name: /Lưu câu hỏi/i });
    fireEvent.click(bookmarkBtn);
    expect(handleBookmark).toHaveBeenCalledWith('q-test-1', false);
  });

  it('PaywallModal renders quota exhausted information and upgrade buttons', () => {
    const handleClose = vi.fn();

    render(
      <BrowserRouter>
        <PaywallModal
          isOpen={true}
          onClose={handleClose}
          resetsAt="2026-09-01T00:00:00.000Z"
          planSlug="free"
        />
      </BrowserRouter>,
    );

    expect(screen.getByText(/Bạn đã dùng hết 5\/5 lượt mở đáp án miễn phí/i)).toBeInTheDocument();
    expect(screen.getByText(/50 lượt mở đáp án/i)).toBeInTheDocument();
    expect(screen.getByText(/Xem các gói Pro/i)).toBeInTheDocument();
  });

  it('QuestionFilterSidebar triggers search and difficulty filters', () => {
    const onSearchChange = vi.fn();
    const onDifficultyChange = vi.fn();
    const onReset = vi.fn();

    render(
      <QuestionFilterSidebar
        search=""
        onSearchChange={onSearchChange}
        role=""
        onRoleChange={vi.fn()}
        seniority=""
        onSeniorityChange={vi.fn()}
        difficulty={undefined}
        onDifficultyChange={onDifficultyChange}
        questionType=""
        onQuestionTypeChange={vi.fn()}
        language="vi"
        onLanguageChange={vi.fn()}
        onReset={onReset}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Tìm câu hỏi, khái niệm...');
    fireEvent.change(searchInput, { target: { value: 'Postgres' } });
    expect(onSearchChange).toHaveBeenCalledWith('Postgres');

    const l3Btn = screen.getByRole('button', { name: 'L3' });
    fireEvent.click(l3Btn);
    expect(onDifficultyChange).toHaveBeenCalledWith(3);
  });

  it('FeedbackModal allows selecting reason and submitting report', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<FeedbackModal isOpen={true} onClose={onClose} onSubmit={onSubmit} />);

    expect(screen.getByText('Báo lỗi hoặc góp ý nội dung câu hỏi')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Gửi báo cáo/i });
    await fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalled();
  });
});
