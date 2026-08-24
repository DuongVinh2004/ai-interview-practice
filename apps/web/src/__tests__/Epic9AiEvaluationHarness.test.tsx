import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminAiEvalPage } from '../features/admin/AdminAiEvalPage';
import { useAuthStore } from '../stores/auth.store';
import { UserRole, UserStatus } from '@ai-interview/contracts';

describe('Epic 9 AI Evaluation Regression Harness Dashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    useAuthStore.getState().setUser({
      id: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      mfaEnabled: true,
      createdAt: '2026-08-01T00:00:00Z',
      profile: {
        id: 'prof-1',
        fullName: 'Platform Admin',
      },
    });

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/admin/ai/eval/latest') || url.includes('/admin/ai/eval/run')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  runId: 'eval_run_test_123',
                  timestamp: '2026-08-24T17:50:00.000Z',
                  datasetVersion: '2.0.0',
                  datasetId: 'golden_benchmark_v2',
                  qualityGate: {
                    passed: true,
                    scoreIntervalAdherence: 95.0,
                    evidencePrecision: 100.0,
                    safetyPassRate: 100.0,
                    p50LatencyMs: 45,
                    p95LatencyMs: 120,
                    totalCases: 15,
                    passedCases: 15,
                    failedCases: 0,
                    gateFailures: [],
                  },
                  sliceMetrics: [
                    {
                      sliceKey: 'locale:vi-VN',
                      sliceCategory: 'LOCALE',
                      totalCases: 8,
                      passedCases: 8,
                      adherencePercentage: 100.0,
                      avgScore: 8.2,
                      avgLatencyMs: 50,
                    },
                    {
                      sliceKey: 'locale:en-US',
                      sliceCategory: 'LOCALE',
                      totalCases: 7,
                      passedCases: 7,
                      adherencePercentage: 100.0,
                      avgScore: 7.9,
                      avgLatencyMs: 48,
                    },
                    {
                      sliceKey: 'competency:SYSTEM_DESIGN',
                      sliceCategory: 'COMPETENCY',
                      totalCases: 3,
                      passedCases: 3,
                      adherencePercentage: 100.0,
                      avgScore: 8.5,
                      avgLatencyMs: 52,
                    },
                  ],
                  caseResults: [
                    {
                      caseId: 'golden_vi_strong_idempotency',
                      locale: 'vi-VN',
                      competencyArea: 'SYSTEM_DESIGN',
                      role: 'Backend Engineer',
                      seniority: 'Senior',
                      score: 9.0,
                      expectedMin: 8.5,
                      expectedMax: 10.0,
                      isScoreWithinInterval: true,
                      evidenceFound: ['cùng transaction'],
                      missingEvidenceTerms: [],
                      isSafetyPassed: true,
                      latencyMs: 45,
                      status: 'PASSED',
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

  it('renders AdminAiEvalPage with Quality Gate banner, metrics cards, slice analytics, and case table', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/ai-eval']}>
          <Routes>
            <Route path="/admin/ai-eval" element={<AdminAiEvalPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/ĐẠT CHUẨN/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/golden_benchmark_v2/i)).toBeInTheDocument();
    expect(screen.getByText('eval_run_test_123')).toBeInTheDocument();
    expect(screen.getByText('golden_vi_strong_idempotency')).toBeInTheDocument();
    expect(screen.getAllByText('SYSTEM_DESIGN').length).toBeGreaterThanOrEqual(1);
  });

  it('triggers on-demand evaluation suite execution on button click', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/ai-eval']}>
          <Routes>
            <Route path="/admin/ai-eval" element={<AdminAiEvalPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Run Full Golden Evaluation Suite|Chạy Toàn bộ/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Run Full Golden Evaluation Suite|Chạy Toàn bộ/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/Evaluation harness completed|hoàn tất/i)).toBeInTheDocument();
    });
  });
});
