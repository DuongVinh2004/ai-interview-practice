import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CompetencyArea } from '@ai-interview/contracts';
import { CompetencyRadarOverlay } from '../features/skills/CompetencyRadarOverlay';
import { SkillTreeView } from '../features/skills/SkillTreeView';
import { ProgressTrendChart } from '../features/skills/ProgressTrendChart';
import { GapAnalysisCard } from '../features/skills/GapAnalysisCard';
import { HeatmapCalendar } from '../features/skills/HeatmapCalendar';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Skill Graph & Benchmark Components (F008)', () => {
  it('renders CompetencyRadarOverlay with polygon and legend', () => {
    const data = [
      {
        area: CompetencyArea.SYSTEM_DESIGN,
        name: 'System Design',
        score: 8.5,
        benchmarkP50: 7.2,
      },
      {
        area: CompetencyArea.DATABASE_CONCURRENCY,
        name: 'Database',
        score: 7.8,
        benchmarkP50: 6.8,
      },
    ];

    render(<CompetencyRadarOverlay data={data} size={300} />);
    expect(screen.getByTestId('competency-radar-overlay')).toBeInTheDocument();
    expect(screen.getByText('Candidate Score')).toBeInTheDocument();
    expect(screen.getByText(/Senior Benchmark/i)).toBeInTheDocument();
  });

  it('renders SkillTreeView with collapsible nodes and scores', () => {
    const nodes = [
      {
        id: 'node-1',
        name: 'System Architecture Fundamentals',
        slug: 'sys-fund',
        level: 2,
        score: 8.2,
        rawScore: 8.2,
        evidenceCount: 3,
        children: [
          {
            id: 'node-1-1',
            name: 'Rate Limiting Algorithms',
            slug: 'rate-limiting',
            level: 3,
            score: 8.5,
            rawScore: 8.5,
            evidenceCount: 2,
          },
        ],
      },
    ];

    render(<SkillTreeView nodes={nodes} />);
    expect(screen.getByTestId('skill-tree-view')).toBeInTheDocument();
    expect(screen.getByText('System Architecture Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('8.2')).toBeInTheDocument();
  });

  it('renders ProgressTrendChart and triggers period changes', () => {
    const trends = [
      { date: '2026-08-01', overallScore: 7.0, areaScores: {} as any },
      { date: '2026-08-10', overallScore: 7.6, areaScores: {} as any },
      { date: '2026-08-20', overallScore: 8.4, areaScores: {} as any },
    ];
    const onPeriodChange = vi.fn();

    render(
      <ProgressTrendChart
        trends={trends}
        overallDelta={1.4}
        selectedPeriod="30d"
        onPeriodChange={onPeriodChange}
      />
    );

    expect(screen.getByTestId('progress-trend-chart')).toBeInTheDocument();
    expect(screen.getByText('+1.4 pts')).toBeInTheDocument();

    const sevenDayBtn = screen.getByText('7d');
    fireEvent.click(sevenDayBtn);
    expect(onPeriodChange).toHaveBeenCalledWith('7d');
  });

  it('renders GapAnalysisCard with high priority badge and recommendation', () => {
    const gap = {
      skillNodeId: 'gap-1',
      name: 'Distributed Lock Contention',
      competencyArea: CompetencyArea.DATABASE_CONCURRENCY,
      currentScore: 5.2,
      targetScore: 8.0,
      gapScore: 2.8,
      priority: 'HIGH' as const,
      recommendation: 'Master Redis Redlock vs DB row-level locks.',
      suggestedAction: 'Start a Focused Remediation session in Database & Concurrency.',
    };

    renderWithProviders(<GapAnalysisCard gap={gap} />);
    expect(screen.getByTestId('gap-analysis-card')).toBeInTheDocument();
    expect(screen.getByText('Distributed Lock Contention')).toBeInTheDocument();
    expect(screen.getByText('HIGH PRIORITY')).toBeInTheDocument();
    expect(screen.getByText('-2.8 pt gap')).toBeInTheDocument();
    expect(screen.getByText(/Practice/i)).toBeInTheDocument();
  });

  it('renders HeatmapCalendar without errors', () => {
    render(<HeatmapCalendar daysCount={28} />);
    expect(screen.getByTestId('heatmap-calendar')).toBeInTheDocument();
    expect(screen.getByText('Practice Activity Heatmap')).toBeInTheDocument();
  });
});
