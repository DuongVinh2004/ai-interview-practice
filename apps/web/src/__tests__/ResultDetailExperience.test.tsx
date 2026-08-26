import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ResultDetailPage } from '../features/history/ResultDetailPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ResultDetailExperience (Phase 4)', () => {
  let queryClient: QueryClient;

  const mockCompletedResult = {
    id: 'session-result-1',
    state: 'COMPLETED',
    overallScore: 8.8,
    jobRole: { name: 'Fullstack Engineer' },
    seniorityLevel: { name: 'Senior' },
    technologies: [
      { id: 'tech-1', name: 'React' },
      { id: 'tech-2', name: 'TypeScript' },
    ],
    rubricAverages: {
      technicalAccuracy: 9.0,
      depth: 8.5,
      clarity: 8.9,
    },
    learningPath: {
      id: 'lp-1',
      summary: 'Focused recommendations on Distributed Cache and Resilience',
      items: [
        {
          id: 'item-1',
          topic: 'Distributed Cache Invalidation',
          gap: 'Needs deeper explanation of cache stampede protection',
          priority: 'HIGH',
          recommendedAction: 'Study Redis cache locking & probabilistic early expiration',
          searchKeywords: ['redis', 'cache stampede'],
          isCompleted: false,
        },
      ],
    },
    turns: [
      {
        id: 'turn-1',
        turnNumber: 1,
        status: 'EVALUATED',
        question: {
          id: 'q-1',
          content: 'How do you handle cache invalidation in distributed microservices?',
          keyFocus: 'Distributed Cache',
        },
        answer: {
          id: 'ans-1',
          content: 'We use write-through caching with Redis pub/sub for invalidation.',
          evaluation: {
            score: 8.8,
            conciseFeedback: 'Solid understanding of invalidation events and message propagation.',
            rubricScores: {
              technicalAccuracy: 9.0,
              depth: 8.5,
              clarity: 8.9,
            },
            evidence: ['Redis pub/sub for invalidation'],
          },
        },
      },
    ],
  };

  beforeEach(() => {
    mockNavigate.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/learning-path/items/item-1') && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: { id: 'item-1', isCompleted: true },
              }),
            ),
        });
      }
      if (url.includes('/interviews/session-result-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ data: mockCompletedResult })),
        });
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    });
  });

  it('renders overall score, role, level, and formative practice disclaimer', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/interviews/session-result-1/result']}>
          <Routes>
            <Route path="/interviews/:id/result" element={<ResultDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Fullstack Engineer/i)).toBeInTheDocument();
      expect(screen.getAllByText(/8.8/i).length).toBeGreaterThanOrEqual(1);
      expect(
        screen.getByText(/Báo Cáo Phân Tích Kỹ Thuật Luyện Tập|Formative Technical Practice/i),
      ).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/interviews/session-result-1/result'),
      expect.anything(),
    );
  });

  it('renders learning path checklist and handles toggle item completion', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/interviews/session-result-1/result']}>
          <Routes>
            <Route path="/interviews/:id/result" element={<ResultDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Distributed Cache Invalidation')).toBeInTheDocument();
      expect(screen.getByText(/HIGH PRIORITY/i)).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTitle(
      /Mark as Completed|Đánh dấu Hoàn thành|Đánh dấu Đã xong|Mark Completed/i,
    );
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/learning-path/items/item-1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('allows expanding session transcript turns and shows quoted evidence', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/interviews/session-result-1/result']}>
          <Routes>
            <Route path="/interviews/:id/result" element={<ResultDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/1: Distributed Cache/i)).toBeInTheDocument();
    });

    // Expand turn accordion
    const turnToggle = screen.getByText(/1: Distributed Cache/i);
    const button = turnToggle.closest('button') || turnToggle;
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getAllByText(/How do you handle cache invalidation/i).length,
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Redis pub\/sub for invalidation/i).length).toBeGreaterThanOrEqual(
        1,
      );
    });
  });
});
