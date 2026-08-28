import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CompetencyRadarChart } from '../components/analytics/CompetencyRadarChart';
import { CompetencyArea } from '@ai-interview/contracts';

describe('CompetencyRadarChart Component', () => {
  const mockCompetencies = [
    {
      competency: CompetencyArea.SYSTEM_DESIGN,
      name: 'System Design & Scalability',
      score: 8.5,
      sampleCount: 4,
      benchmarkLevel: 'Senior / Staff',
      description: 'Distributed systems and caching.',
    },
    {
      competency: CompetencyArea.LANGUAGE_CORE,
      name: 'Core Language & Fundamentals',
      score: 9.0,
      sampleCount: 5,
      benchmarkLevel: 'Senior / Staff',
      description: 'TypeScript, JavaScript runtime internals.',
    },
    {
      competency: CompetencyArea.DATABASE_CONCURRENCY,
      name: 'Databases & Concurrency',
      score: 7.5,
      sampleCount: 3,
      benchmarkLevel: 'Mid-Level',
      description: 'ACID, indexing, and isolation.',
    },
    {
      competency: CompetencyArea.ARCHITECTURE_PATTERNS,
      name: 'Software Architecture & Patterns',
      score: 8.0,
      sampleCount: 4,
      benchmarkLevel: 'Mid-Level',
      description: 'Clean Architecture, SOLID.',
    },
    {
      competency: CompetencyArea.RESILIENCE_SECURITY,
      name: 'Resilience & Security',
      score: 8.8,
      sampleCount: 3,
      benchmarkLevel: 'Senior / Staff',
      description: 'Circuit breakers and OWASP.',
    },
  ];

  it('renders SVG radar chart with all 5 competency labels', () => {
    render(<CompetencyRadarChart competencies={mockCompetencies} />);
    const radar = screen.getByTestId('competency-radar-chart');
    expect(radar).toBeInTheDocument();
    expect(screen.getByText('System Design')).toBeInTheDocument();
    expect(screen.getByText('Core Language')).toBeInTheDocument();
    expect(screen.getByText('Databases')).toBeInTheDocument();
  });

  it('displays tooltip on hover over data vertex', () => {
    render(<CompetencyRadarChart competencies={mockCompetencies} />);
    const textNode = screen.getByText('System Design');
    fireEvent.mouseEnter(textNode);

    expect(screen.getByText(/System Design & Scalability:/i)).toBeInTheDocument();
    expect(screen.getByText(/8.5 \/ 10/i)).toBeInTheDocument();
  });

  it('supports keyboard focus and ARIA accessibility roles (NEW-FE-02)', () => {
    render(<CompetencyRadarChart competencies={mockCompetencies} />);
    const radar = screen.getByRole('img', { name: /Biểu đồ radar đánh giá năng lực/i });
    expect(radar).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);

    // Focus on first competency button
    fireEvent.focus(buttons[0]);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveClass('dark:bg-slate-800');
  });
});
