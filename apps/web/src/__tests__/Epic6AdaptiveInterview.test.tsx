import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InterviewRoomPage } from '../features/interview/InterviewRoomPage';

describe('Epic 6 Adaptive Interview & Follow-Up Probing', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/interviews/session-rem-123')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  id: 'session-rem-123',
                  userId: 'user-1',
                  state: 'ACTIVE',
                  sessionMode: 'FOCUSED_REMEDIATION',
                  competencyArea: 'DATABASE_CONCURRENCY',
                  isSandbox: true,
                  currentTurn: 2,
                  totalTurns: 3,
                  targetDifficulty: 2,
                  jobRole: { name: 'Backend Engineer' },
                  seniorityLevel: { name: 'Senior' },
                  technologies: [{ id: 'tech-1', name: 'PostgreSQL' }],
                  turns: [
                    {
                      id: 'turn-1',
                      turnNumber: 1,
                      difficulty: 2,
                      status: 'EVALUATED',
                      isFollowUp: false,
                      question: { content: 'Explain transaction isolation levels.' },
                      answer: { content: 'Answer 1', evaluation: { score: 7.0 } },
                    },
                    {
                      id: 'turn-2',
                      turnNumber: 2,
                      difficulty: 2,
                      status: 'QUESTION_READY',
                      isFollowUp: true,
                      question: {
                        content:
                          'How would you mitigate deadlocks in high concurrency batch updates?',
                        keyFocus: 'Deadlock Mitigation',
                      },
                      answer: null,
                    },
                    {
                      id: 'turn-3',
                      turnNumber: 3,
                      difficulty: 2,
                      status: 'PENDING',
                      isFollowUp: false,
                    },
                  ],
                },
              }),
            ),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ data: {} })),
      });
    });
  });

  it('renders focused remediation, sandbox badge, and follow-up probe indicator', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/interviews/session-rem-123']}>
          <Routes>
            <Route path="/interviews/:id" element={<InterviewRoomPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Sandbox Practice|Chế độ Thử nghiệm/i)).toBeInTheDocument();
      expect(screen.getByText(/Focused Remediation|Luyện tập Trọng tâm/i)).toBeInTheDocument();
      expect(screen.getByText(/AI Follow-Up Probe|Câu hỏi Đào sâu AI/i)).toBeInTheDocument();
      expect(
        screen.getByText('How would you mitigate deadlocks in high concurrency batch updates?'),
      ).toBeInTheDocument();
    });
  });
});
