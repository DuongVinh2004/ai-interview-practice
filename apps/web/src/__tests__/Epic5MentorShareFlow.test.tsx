import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PublicSharedResultPage } from '../features/share/PublicSharedResultPage';

describe('Epic 5 Mentor Share Public Review Flow', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      // POST feedback
      if (url.includes('/feedback') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  id: 'feedback-1',
                  turnNumber: 1,
                  mentorName: 'Staff Tech Lead',
                  comment: 'Solid distributed systems analysis.',
                  createdAt: new Date().toISOString(),
                },
              }),
            ),
        });
      }

      // GET public share report
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              data: {
                shareTokenId: 'token-uuid-1',
                isAnonymized: true,
                expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
                viewCount: 5,
                createdAt: new Date().toISOString(),
                candidate: {
                  fullName: 'Anonymous Candidate',
                  targetRole: 'Backend Engineer',
                  targetLevel: 'Senior',
                },
                session: {
                  id: 'session-123',
                  state: 'COMPLETED',
                  overallScore: 8.8,
                  completedAt: new Date().toISOString(),
                  jobRole: { name: 'Backend Engineer' },
                  seniorityLevel: { name: 'Senior' },
                  technologies: [{ id: 'tech-1', name: 'PostgreSQL' }],
                  rubricAverages: {
                    technicalAccuracy: 9.0,
                    depth: 8.5,
                    clarity: 9.0,
                  },
                  turns: [
                    {
                      turnNumber: 1,
                      difficulty: 3,
                      status: 'COMPLETED',
                      question: {
                        content: 'How do you design a high-throughput idempotency service?',
                        keyFocus: 'Idempotency and Concurrency',
                      },
                      answer: {
                        content:
                          'Use distributed locks and unique request tokens in Redis/PostgreSQL.',
                        submittedAt: new Date().toISOString(),
                        evaluation: {
                          score: 9.0,
                          rubricScores: { technicalAccuracy: 9.0, depth: 9.0, clarity: 9.0 },
                          strengths: ['Excellent concurrency handling'],
                          improvements: ['Discuss TTL expiry scenarios'],
                          conciseFeedback: 'High senior level depth.',
                          evidence: 'Accurate isolation mechanisms described.',
                        },
                      },
                    },
                  ],
                  learningPath: null,
                },
                mentorFeedback: [],
              },
            }),
          ),
      });
    });
  });

  it('renders public shared report with anonymous candidate information and scorecard', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/share/test-crypto-token-123']}>
          <Routes>
            <Route path="/share/:token" element={<PublicSharedResultPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Anonymous Candidate')).toBeInTheDocument();
      expect(screen.getByText('Backend Engineer (Senior)')).toBeInTheDocument();
      expect(screen.getByText('8.8')).toBeInTheDocument();
      expect(
        screen.getByText('How do you design a high-throughput idempotency service?'),
      ).toBeInTheDocument();
    });
  });

  it('allows mentor to submit review commentary', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/share/test-crypto-token-123']}>
          <Routes>
            <Route path="/share/:token" element={<PublicSharedResultPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Alex Nguyen/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Alex Nguyen/i);
    const commentInput = screen.getByPlaceholderText(
      /Share technical insights|Chia sẻ góc nhìn kỹ thuật/i,
    );
    const submitBtn = screen.getByRole('button', { name: /Submit Review Note|Gửi Nhận xét/i });

    fireEvent.change(nameInput, { target: { value: 'Staff Tech Lead' } });
    fireEvent.change(commentInput, {
      target: { value: 'Solid distributed systems analysis and trade-offs.' },
    });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Mentor review feedback submitted successfully|Đã gửi nhận xét của Mentor/i,
        ),
      ).toBeInTheDocument();
    });
  });
});
