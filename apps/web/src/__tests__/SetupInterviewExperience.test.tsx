import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SetupInterviewPage } from '../features/setup/SetupInterviewPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('SetupInterviewExperience (Phase 2)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockNavigate.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/taxonomies/job-roles')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: [
                  { id: 'role-1', name: 'Backend Engineer', description: 'Server-side systems' },
                  { id: 'role-2', name: 'Frontend Engineer', description: 'Web UI apps' },
                ],
              }),
            ),
        });
      }
      if (url.includes('/taxonomies/levels')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: [
                  { id: 'lvl-1', name: 'Junior', description: '1-2 years' },
                  { id: 'lvl-2', name: 'Senior', description: '5+ years' },
                ],
              }),
            ),
        });
      }
      if (url.includes('/taxonomies/technologies')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: [
                  { id: 'tech-1', name: 'Node.js' },
                  { id: 'tech-2', name: 'React' },
                  { id: 'tech-3', name: 'PostgreSQL' },
                ],
              }),
            ),
        });
      }
      if (url.includes('/interviews') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: { id: 'session-created-123', state: 'CREATED' },
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

  it('renders default setup view with 3-step hierarchy and default role/level', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SetupInterviewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
      expect(screen.getByText('Junior')).toBeInTheDocument();
      expect(screen.getByText('Node.js')).toBeInTheDocument();
    });

    // Verify primary launch action
    expect(
      screen.getByRole('button', { name: /Bắt đầu Phỏng vấn|Start Practice/i }),
    ).toBeInTheDocument();
  });

  it('validates technology selection and prevents submit when empty', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SetupInterviewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Node.js')).toBeInTheDocument();
    });

    // Initially 0 technologies selected, submit button is disabled
    const startBtn = screen.getByRole('button', {
      name: /Bắt đầu Phỏng vấn|Start Practice Session/i,
    });
    expect(startBtn).toBeDisabled();
  });

  it('successfully starts an interview and navigates exactly once', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SetupInterviewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Node.js')).toBeInTheDocument();
    });

    // Select technology
    const techBtn = screen.getByRole('button', { name: /Node.js/i });
    fireEvent.click(techBtn);

    const startBtn = screen.getByRole('button', {
      name: /Bắt đầu Phỏng vấn|Start Practice Session/i,
    });
    expect(startBtn).not.toBeDisabled();

    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/interviews/session-created-123');
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });

  it('handles API failure gracefully, displays error and maintains selections', async () => {
    // Override API to fail
    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/interviews') && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                message: 'AI Service Temporarily Unavailable',
              }),
            ),
        });
      }
      if (url.includes('/taxonomies/job-roles')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(JSON.stringify({ data: [{ id: 'role-1', name: 'Backend Engineer' }] })),
        });
      }
      if (url.includes('/taxonomies/levels')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ data: [{ id: 'lvl-1', name: 'Junior' }] })),
        });
      }
      if (url.includes('/taxonomies/technologies')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(JSON.stringify({ data: [{ id: 'tech-1', name: 'Node.js' }] })),
        });
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SetupInterviewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Node.js')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Node.js/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /Bắt đầu Phỏng vấn|Start Practice Session/i }),
    );

    await waitFor(() => {
      expect(
        screen.getAllByText(/AI Service Temporarily Unavailable|Không thể khởi tạo/i).length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText(/1\/5/i).length).toBeGreaterThan(0);
    });
  });

  it('handles 403 QUOTA_EXCEEDED gracefully with upgrade call to action', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/interviews') && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 403,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                code: 'QUOTA_EXCEEDED',
                message: 'Monthly quota limit reached for SESSION_COUNT (3/3)',
              }),
            ),
        });
      }
      if (url.includes('/taxonomies/job-roles')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(JSON.stringify({ data: [{ id: 'role-1', name: 'Backend Engineer' }] })),
        });
      }
      if (url.includes('/taxonomies/levels')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ data: [{ id: 'lvl-1', name: 'Junior' }] })),
        });
      }
      if (url.includes('/taxonomies/technologies')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(JSON.stringify({ data: [{ id: 'tech-1', name: 'Node.js' }] })),
        });
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SetupInterviewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Node.js')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Node.js/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /Bắt đầu Phỏng vấn|Start Practice Session/i }),
    );

    await waitFor(() => {
      expect(screen.getAllByText(/hạn mức|quota/i).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /nâng cấp|upgrade/i }).length).toBeGreaterThan(
        0,
      );
    });
  });
});
