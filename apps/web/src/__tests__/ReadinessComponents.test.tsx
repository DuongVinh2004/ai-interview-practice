import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompetencyArea } from '@ai-interview/contracts';
import { ReadinessGauge } from '../features/readiness/ReadinessGauge';
import { TierBadge } from '../features/readiness/TierBadge';
import { TimeEstimateCard } from '../features/readiness/TimeEstimateCard';
import { CompetencyBreakdownTable } from '../features/readiness/CompetencyBreakdownTable';
import { MilestoneTimeline } from '../features/readiness/MilestoneTimeline';

describe('Readiness Score Components (F009)', () => {
  it('renders ReadinessGauge with percentage and 95% CI band', () => {
    render(
      <ReadinessGauge
        score={82.5}
        confidenceLow={78.0}
        confidenceHigh={87.0}
        size={240}
      />
    );

    expect(screen.getByTestId('readiness-gauge')).toBeInTheDocument();
    expect(screen.getByText('82.5')).toBeInTheDocument();
    expect(screen.getByText(/95% CI: \[78.0% – 87.0%\]/i)).toBeInTheDocument();
  });

  it('renders TierBadge with color styling and Vietnamese translation', () => {
    render(
      <TierBadge
        tierSlug="tier-3"
        name="Big Tech Ready (L5/L6)"
        nameVi="Sẵn sàng Big Tech"
        size="md"
      />
    );

    expect(screen.getByTestId('tier-badge')).toBeInTheDocument();
    expect(screen.getByText('Big Tech Ready (L5/L6)')).toBeInTheDocument();
    expect(screen.getByText('(Sẵn sàng Big Tech)')).toBeInTheDocument();
  });

  it('renders TimeEstimateCard with weekly rate and projection weeks', () => {
    render(
      <TimeEstimateCard
        weeksToNextTier={4}
        estimatedTargetDate="2026-09-24"
        weeklyRate={0.35}
        currentTierSlug="tier-2"
      />
    );

    expect(screen.getByTestId('time-estimate-card')).toBeInTheDocument();
    expect(screen.getByText('+0.35 pts/wk')).toBeInTheDocument();
    expect(screen.getByText(/~4 weeks/i)).toBeInTheDocument();
  });

  it('renders CompetencyBreakdownTable with weights and status badges', () => {
    const items = [
      {
        area: CompetencyArea.SYSTEM_DESIGN,
        name: 'System Design & Scalability',
        currentScore: 8.5,
        targetScore: 8.5,
        weight: 0.3,
        fulfillmentPercentage: 100,
        status: 'TARGET_MET' as const,
        velocity: 0.25,
        estimatedWeeksToTarget: 0,
      },
      {
        area: CompetencyArea.DATABASE_CONCURRENCY,
        name: 'Database & Concurrency',
        currentScore: 6.8,
        targetScore: 8.0,
        weight: 0.25,
        fulfillmentPercentage: 85,
        status: 'APPROACHING' as const,
        velocity: 0.25,
        estimatedWeeksToTarget: 5,
      },
    ];

    render(<CompetencyBreakdownTable items={items} />);
    expect(screen.getByTestId('competency-breakdown-table')).toBeInTheDocument();
    expect(screen.getByText('System Design & Scalability')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('Target Met')).toBeInTheDocument();
    expect(screen.getByText('Approaching')).toBeInTheDocument();
  });

  it('renders MilestoneTimeline with completed milestones', () => {
    const milestones = [
      { type: '25%', targetScore: 25, achieved: true, achievedAt: '2026-06-01' },
      { type: '50%', targetScore: 50, achieved: true, achievedAt: '2026-07-01' },
      { type: '75%', targetScore: 75, achieved: true, achievedAt: '2026-08-01' },
      { type: '85%', targetScore: 85, achieved: false },
      { type: '100%', targetScore: 100, achieved: false },
    ];

    render(<MilestoneTimeline milestones={milestones} />);
    expect(screen.getByTestId('milestone-timeline')).toBeInTheDocument();
    expect(screen.getByText('3 of 5 Completed')).toBeInTheDocument();
    expect(screen.getByText('25% Ready')).toBeInTheDocument();
    expect(screen.getByText('85% Ready')).toBeInTheDocument();
  });
});
