import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ResultDetailPage } from '../features/history/ResultDetailPage';

describe('LearningPathChecklist in ResultDetailPage (Epic 6)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      // PATCH item status
      if (url.includes('/learning-path/items/item-1') && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  id: 'item-1',
                  isCompleted: true,
                  completedAt: new Date().toISOString(),
                },
              }),
            ),
        });
      }

      // Default GET session
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              data: {
                id: 'session-123',
                state: 'COMPLETED',
                overallScore: 8.5,
                jobRole: { name: 'Backend Engineer' },
                seniorityLevel: { name: 'Senior' },
                technologies: [{ id: 'tech-1', name: 'PostgreSQL' }],
                turns: [],
                learningPath: {
                  id: 'lp-1',
                  summary: 'Targeted skill gap recommendations',
                  items: [
                    {
                      id: 'item-1',
                      topic: 'Database Lock Contention & Isolation',
                      gap: 'Lacks deep concurrency mechanisms',
                      priority: 'HIGH',
                      recommendedAction: 'Study READ COMMITTED vs REPEATABLE READ in PostgreSQL',
                      searchKeywords: ['postgres', 'locking'],
                      isCompleted: false,
                    },
                  ],
                },
              },
            }),
          ),
      });
    });
  });

  it('renders learning path checklist and allows user to toggle item completion', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/interviews/session-123/result']}>
          <Routes>
            <Route path="/interviews/:id/result" element={<ResultDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Database Lock Contention & Isolation')).toBeInTheDocument();
      expect(screen.getByText(/Practice This Topic|Luyện tập Chủ đề này/i)).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTitle(/Mark as Completed|Đánh dấu Hoàn thành|Đánh dấu Đã xong|Mark Completed/i);
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/learning-path/items/item-1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });
});
