import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfilePage } from '../features/profile/ProfilePage';
import { HistoryPage } from '../features/history/HistoryPage';
import { ResultDetailPage } from '../features/history/ResultDetailPage';
import { useAuthStore } from '../stores/auth.store';
import { UserRole, UserStatus } from '@ai-interview/contracts';

describe('Epic 7 Profile, Benchmark & Export Features', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    useAuthStore.getState().setUser({
      id: 'user-1',
      email: 'alex@example.com',
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
      mfaEnabled: false,
      createdAt: '2026-08-01T00:00:00Z',
      profile: {
        id: 'prof-1',
        fullName: 'Alex Nguyen',
        targetRole: 'Senior Backend Engineer',
        targetLevel: 'Senior',
        bio: 'Distributed systems engineer',
      },
    });

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/profile/benchmarks')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  userId: 'user-1',
                  targetLevel: 'Senior',
                  evaluatedTurnsCount: 8,
                  overallReadinessScore: 8.6,
                  readinessPercentage: 92,
                  benchmarks: [
                    {
                      competency: 'SYSTEM_DESIGN',
                      name: 'System Design & Scalability',
                      userScore: 8.8,
                      benchmarkScore: 8.5,
                      gap: 0.3,
                      status: 'EXCEEDS',
                      recommendation: 'Practice distributed cache hierarchies.',
                    },
                    {
                      competency: 'DATABASE_CONCURRENCY',
                      name: 'Database & Transaction Isolation',
                      userScore: 8.4,
                      benchmarkScore: 8.0,
                      gap: 0.4,
                      status: 'EXCEEDS',
                      recommendation: 'Focus on MVCC and locking.',
                    },
                  ],
                  topStrengths: ['System Design & Scalability'],
                  priorityGaps: [],
                  summary: 'Outstanding technical proficiency for Senior roles.',
                },
              }),
            ),
        });
      }

      if (url.endsWith('/profile')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  id: 'prof-1',
                  userId: 'user-1',
                  fullName: 'Alex Nguyen',
                  targetRole: 'Senior Backend Engineer',
                  targetLevel: 'Senior',
                  bio: 'Distributed systems engineer',
                  user: {
                    id: 'user-1',
                    email: 'alex@example.com',
                    role: 'CANDIDATE',
                    status: 'ACTIVE',
                  },
                },
              }),
            ),
        });
      }

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
                      id: 'sess-1',
                      state: 'COMPLETED',
                      sessionMode: 'STANDARD',
                      isSandbox: false,
                      currentTurn: 5,
                      totalTurns: 5,
                      targetDifficulty: 2,
                      overallScore: 8.5,
                      createdAt: '2026-08-20T00:00:00Z',
                      jobRole: { name: 'Backend Engineer' },
                      seniorityLevel: { name: 'Senior' },
                      technologies: [{ name: 'PostgreSQL' }],
                    },
                    {
                      id: 'sess-2',
                      state: 'COMPLETED',
                      sessionMode: 'FOCUSED_REMEDIATION',
                      isSandbox: true,
                      currentTurn: 3,
                      totalTurns: 3,
                      targetDifficulty: 2,
                      overallScore: 9.0,
                      createdAt: '2026-08-21T00:00:00Z',
                      jobRole: { name: 'Backend Engineer' },
                      seniorityLevel: { name: 'Senior' },
                      technologies: [{ name: 'Redis' }],
                    },
                  ],
                  meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
                },
              }),
            ),
        });
      }

      if (url.includes('/interviews/sess-123')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  id: 'sess-123',
                  userId: 'user-1',
                  state: 'COMPLETED',
                  overallScore: 8.7,
                  jobRole: { name: 'Backend Engineer' },
                  seniorityLevel: { name: 'Senior' },
                  technologies: [{ name: 'PostgreSQL' }],
                  turns: [],
                  learningPath: { items: [] },
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

  it('renders ProfilePage with user credentials and benchmark gap breakdown', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alex Nguyen')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Senior Backend Engineer')).toBeInTheDocument();
      expect(screen.getByText('92%')).toBeInTheDocument();
      expect(screen.getByText('System Design & Scalability')).toBeInTheDocument();
      expect(screen.getByText(/GDPR/i)).toBeInTheDocument();
    });
  });

  it('renders HistoryPage with search input, session mode filters, and session list', async () => {
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
      expect(screen.getByPlaceholderText(/Search by role|Tìm theo vị trí/i)).toBeInTheDocument();
      expect(
        screen.getAllByText(/Focused Remediation|Luyện tập Trọng tâm/i).length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText(/Sandbox|Thao trường/i).length).toBeGreaterThan(0);
      expect(screen.getByText('8.5/10')).toBeInTheDocument();
      expect(screen.getByText('9.0/10')).toBeInTheDocument();
    });
  });

  it('renders ResultDetailPage with Export JSON and Print PDF actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/interviews/sess-123/result']}>
          <Routes>
            <Route path="/interviews/:id/result" element={<ResultDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Download JSON|Tải file JSON|Tải về JSON/i)).toBeInTheDocument();
      expect(screen.getByText(/Print \/ PDF|In \/ Xuất PDF|In \/ Lưu PDF/i)).toBeInTheDocument();
    });
  });
});
