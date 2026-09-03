import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InterviewRoomPage } from '../features/interview/InterviewRoomPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('InterviewRoomExperience (Phase 3)', () => {
  let queryClient: QueryClient;

  const mockActiveSession = {
    id: 'session-active-1',
    state: 'ACTIVE',
    targetDifficulty: 'MEDIUM',
    sessionMode: 'STANDARD',
    currentTurn: 1,
    totalTurns: 5,
    overallScore: null,
    jobRole: { name: 'Backend Engineer' },
    seniorityLevel: { name: 'Senior' },
    technologies: [{ id: 'tech-1', name: 'Node.js' }],
    turns: [
      {
        id: 'turn-1',
        turnNumber: 1,
        status: 'QUESTION_DELIVERED',
        difficulty: 'MEDIUM',
        question: {
          id: 'q-1',
          content: 'Explain the event loop in Node.js and how microtasks differ from macrotasks.',
          keyFocus: 'Concurrency & Event Loop',
        },
        answer: null,
      },
    ],
  };

  const storageMap: Record<string, string> = {};

  beforeEach(() => {
    mockNavigate.mockReset();
    Object.keys(storageMap).forEach(k => delete storageMap[k]);
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => storageMap[k] || null,
        setItem: (k: string, v: string) => {
          storageMap[k] = v;
        },
        removeItem: (k: string) => {
          delete storageMap[k];
        },
        clear: () => {
          Object.keys(storageMap).forEach(k => delete storageMap[k]);
        },
      },
      writable: true,
    });
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/interviews/session-active-1/answers') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  id: 'ans-1',
                  content: 'Submitted response content',
                },
              }),
            ),
        });
      }
      if (url.includes('/interviews/session-active-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ data: mockActiveSession })),
        });
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    });
  });

  it('renders question ready state with key focus badge and answer textarea', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/interviews/session-active-1']}>
          <Routes>
            <Route path="/interviews/:id" element={<InterviewRoomPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Explain the event loop in Node.js/i)).toBeInTheDocument();
      expect(screen.getByText('Concurrency & Event Loop')).toBeInTheDocument();
      expect(
        screen.getByLabelText(
          /type your detailed technical explanation|Nhập câu trả lời kỹ thuật chi tiết/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it('preserves draft answer in localStorage and restores it', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/interviews/session-active-1']}>
          <Routes>
            <Route path="/interviews/:id" element={<InterviewRoomPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText(
          /type your detailed technical explanation|Nhập câu trả lời kỹ thuật chi tiết/i,
        ),
      ).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText(
      /type your detailed technical explanation|Nhập câu trả lời kỹ thuật chi tiết/i,
    );
    fireEvent.change(textarea, {
      target: { value: 'Microtasks run at the end of the current phase.' },
    });

    const draftKey = Object.keys(storageMap).find(k => k.includes('session-active-1-turn-1'));
    expect(draftKey).toBeDefined();
    expect(storageMap[draftKey!]).toBe('Microtasks run at the end of the current phase.');
  });

  it('prevents double-submit when submission is in progress', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/answers') && options?.method === 'POST') {
        callCount++;
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              text: () => Promise.resolve(JSON.stringify({ data: { id: 'ans-1' } })),
            });
          }, 150);
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ data: mockActiveSession })),
      });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/interviews/session-active-1']}>
          <Routes>
            <Route path="/interviews/:id" element={<InterviewRoomPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText(
          /type your detailed technical explanation|Nhập câu trả lời kỹ thuật chi tiết/i,
        ),
      ).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText(
      /type your detailed technical explanation|Nhập câu trả lời kỹ thuật chi tiết/i,
    );
    fireEvent.change(textarea, { target: { value: 'My structured answer.' } });

    const submitBtn = screen.getByRole('button', { name: /submit answer|Nộp câu trả lời/i });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    expect(callCount).toBe(1);

    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('renders completed session state with overall score and result link', async () => {
    const freshClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const completedSession = {
      ...mockActiveSession,
      id: 'session-completed-1',
      state: 'COMPLETED',
      overallScore: 8.5,
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/interviews/session-completed-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ data: completedSession })),
        });
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    });

    render(
      <QueryClientProvider client={freshClient}>
        <MemoryRouter initialEntries={['/interviews/session-completed-1']}>
          <Routes>
            <Route path="/interviews/:id" element={<InterviewRoomPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/5-Turn Interview Completed|Hoàn thành 5 lượt/i)).toBeInTheDocument();
      expect(screen.getByText(/8.5/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /view full result|Xem Kết quả Chi tiết/i }),
      ).toBeInTheDocument();
    });
  });
});
