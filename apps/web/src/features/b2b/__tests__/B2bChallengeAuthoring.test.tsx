import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChallengeAuthoringPage } from '../ChallengeAuthoringPage';
import { apiClient } from '../../../lib/api-client';

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('B2B Enterprise Custom Challenge Authoring Portal (Roadmap 2.2)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/b2b/challenges') {
        return Promise.resolve({
          data: [
            {
              id: 'c-1',
              slug: 'acme-sql-injection-fix',
              title: 'Fix SQL Injection in ACME Billing API',
              domain: 'BACKEND',
              category: 'SECURITY',
              difficulty: 3,
              status: 'DRAFT',
              createdAt: '2026-10-27T00:00:00.000Z',
            },
          ],
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('renders challenge authoring header and existing custom challenges list', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ChallengeAuthoringPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('B2B Challenge Authoring Portal')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Fix SQL Injection in ACME Billing API')).toBeInTheDocument();
    });
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
  });

  it('validates challenge package and displays 6-stage CI validation report', async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      data: {
        overallPass: true,
        totalStages: 6,
        passedStages: 6,
        failedStages: 0,
        stages: [
          { stage: '1_MANIFEST_SCHEMA', status: 'PASS', message: 'Valid schema', durationMs: 2 },
          {
            stage: '2_BASELINE_FAILURE',
            status: 'PASS',
            message: 'Baseline failed',
            durationMs: 40,
          },
          { stage: '3_SOLUTION_PASS', status: 'PASS', message: 'Solution passed', durationMs: 15 },
          {
            stage: '4_HIDDEN_TESTS_PASS',
            status: 'PASS',
            message: 'Hidden tests passed',
            durationMs: 20,
          },
          {
            stage: '5_ZERO_SECRETS',
            status: 'PASS',
            message: 'No secrets detected',
            durationMs: 1,
          },
          { stage: '6_ZERO_NETWORK', status: 'PASS', message: 'Network isolated', durationMs: 1 },
        ],
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ChallengeAuthoringPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const validateBtn = screen.getByRole('button', { name: /Validate Challenge/i });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(screen.getByText(/Validation Passed: 6\/6 Stages/i)).toBeInTheDocument();
    });
    expect(screen.getByText('1_MANIFEST_SCHEMA')).toBeInTheDocument();
    expect(screen.getByText('6_ZERO_NETWORK')).toBeInTheDocument();
  });

  it('saves challenge draft when form is submitted', async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      data: {
        challenge: {
          id: 'c-2',
          slug: 'acme-rate-limiter',
          title: 'Design ACME Redis Rate Limiter',
          status: 'DRAFT',
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ChallengeAuthoringPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const titleInput = screen.getByLabelText(/Challenge Title/i);
    fireEvent.change(titleInput, { target: { value: 'Design ACME Redis Rate Limiter' } });

    const saveDraftBtn = screen.getByRole('button', { name: /Save Challenge Draft/i });
    fireEvent.click(saveDraftBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/b2b/challenges',
        expect.objectContaining({
          manifest: expect.objectContaining({
            title: 'Design ACME Redis Rate Limiter',
          }),
        }),
      );
    });
  });
});
