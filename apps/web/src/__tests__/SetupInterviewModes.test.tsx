import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SetupInterviewPage } from '../features/setup/SetupInterviewPage';

describe('SetupInterviewPage Modes (Epic 6)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/taxonomies/job-roles')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: [
                  {
                    id: 'role-1',
                    name: 'Backend Engineer',
                    slug: 'backend',
                    description: 'Server-side apps',
                  },
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
                  { id: 'lvl-1', name: 'Senior', slug: 'senior', description: 'Senior level' },
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
                data: [{ id: 'tech-1', name: 'PostgreSQL', slug: 'postgresql' }],
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

  it('renders standard, remediation, and sandbox mode options', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SetupInterviewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Phỏng vấn Toàn diện|Full Mock Interview/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Luyện tập Trọng tâm|Focused Remediation/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Thao trường Thử nghiệm|Quick Sandbox/i }),
      ).toBeInTheDocument();
    });
  });

  it('switches to focused remediation mode and shows competency picker and turn counts', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SetupInterviewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Luyện tập Trọng tâm|Focused Remediation/i }),
      ).toBeInTheDocument();
    });

    const remediationTab = screen.getByRole('button', {
      name: /Luyện tập Trọng tâm|Focused Remediation/i,
    });
    fireEvent.click(remediationTab);

    expect(
      screen.getByText(/Focus Competency Area|Năng lực Kỹ thuật Trọng tâm/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/System Design & Scalability|Thiết Kế Hệ Thống/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: /3 (Questions|câu hỏi)/i }).length,
    ).toBeGreaterThan(0);
  });
});
