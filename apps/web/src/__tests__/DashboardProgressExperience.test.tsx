import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { HistoryPage } from '../features/history/HistoryPage';

describe('Dashboard & History Experience (Phase 5)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders onboarding 3-step guide for first-time candidate with 0 sessions', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/analytics/competency-radar')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  totalEvaluatedTurns: 0,
                  competencies: [],
                },
              }),
            ),
        });
      }
      if (url.includes('/analytics/progress')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  sessions: [],
                  averageScore: 0,
                  highestScore: 0,
                },
              }),
            ),
        });
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/3 Bước Khởi Đầu Luyện Tập|3 Steps to Master Your Practice/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Chọn Mục Tiêu Nghề Nghiệp|Set Your Target Stack/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Bắt đầu Lượt Đầu Tiên|Launch First Session/i)).toBeInTheDocument();
    });
  });

  it('renders returning candidate dashboard with dominant primary action and radar', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/analytics/competency-radar')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  totalEvaluatedTurns: 5,
                  competencies: [
                    {
                      name: 'System Design',
                      competency: 'SYSTEM_DESIGN',
                      score: 8.5,
                      turnsCount: 3,
                    },
                    { name: 'Databases', competency: 'DATABASES', score: 7.8, turnsCount: 2 },
                  ],
                  topStrengths: ['System Design', 'Databases'],
                  growthAreas: ['Concurrency & Locking'],
                },
              }),
            ),
        });
      }
      if (url.includes('/analytics/progress')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  sessions: [
                    {
                      sessionId: 'sess-1',
                      overallScore: 8.5,
                      score: 8.5,
                      jobRoleName: 'Backend Engineer',
                      seniorityLevelName: 'Senior',
                      createdAt: new Date().toISOString(),
                    },
                  ],
                  averageScore: 8.5,
                  highestScore: 8.5,
                  scoreVelocity: 1.2,
                },
              }),
            ),
        });
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Bắt đầu Phỏng vấn Mới|Start New Interview/i)).toBeInTheDocument();
      expect(screen.getAllByText(/System Design/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders history page with filter controls and handles search input', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/interviews/history')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  items: [
                    {
                      id: 'hist-1',
                      state: 'COMPLETED',
                      sessionMode: 'STANDARD',
                      targetDifficulty: 'MEDIUM',
                      overallScore: 8.5,
                      currentTurn: 5,
                      totalTurns: 5,
                      createdAt: new Date().toISOString(),
                      jobRole: { name: 'Backend Engineer' },
                      seniorityLevel: { name: 'Senior' },
                      technologies: [{ id: 't1', name: 'PostgreSQL' }],
                    },
                  ],
                  meta: {
                    page: 1,
                    totalPages: 1,
                    total: 1,
                    hasNextPage: false,
                    hasPrevPage: false,
                  },
                },
              }),
            ),
        });
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/history']}>
          <Routes>
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Backend Engineer • Senior/i)).toBeInTheDocument();
      expect(screen.getByText(/View Result/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/Search interviews/i);
    fireEvent.change(searchInput, { target: { value: 'PostgreSQL' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=PostgreSQL'),
        expect.anything(),
      );
    });
  });
});
