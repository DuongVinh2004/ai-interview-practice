import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentPalette } from '../features/system-design/ComponentPalette';
import { DesignFeedbackPanel } from '../features/system-design/DesignFeedbackPanel';
import { CanvasTimelapse } from '../features/system-design/CanvasTimelapse';
import { DesignEvaluationReport } from '../features/system-design/DesignEvaluationReport';

describe('System Design Whiteboard Components (F003)', () => {
  it('renders ComponentPalette and adds components on click', () => {
    const onAdd = vi.fn();
    render(<ComponentPalette onAddComponent={onAdd} />);

    expect(screen.getByTestId('component-palette')).toBeInTheDocument();
    expect(screen.getByText('Load Balancer')).toBeInTheDocument();
    expect(screen.getByText('API Gateway')).toBeInTheDocument();
    expect(screen.getByText('In-Memory Cache')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Load Balancer'));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ type: 'LOAD_BALANCER' }));
  });

  it('renders DesignFeedbackPanel with detected components and analysis details', () => {
    const analysis = {
      summary: 'Distributed URL shortener architecture with cache and sharding.',
      architectureStyle: 'Event-Driven Microservices',
      detectedComponents: ['Load Balancer', 'API Gateway', 'Redis Cache'],
      strengths: ['High write throughput via queue decoupling'],
      potentialBottlenecks: ['Database replication lag'],
      realtimeSuggestions: ['How do you handle hot keys?'],
      rubricScores: {
        requirements: 8.5,
        highLevel: 8.5,
        componentDetail: 8.0,
        scalability: 8.5,
        dataModel: 8.0,
      },
    };
    const onTrigger = vi.fn();

    render(
      <DesignFeedbackPanel analysis={analysis} isAnalyzing={false} onTriggerAnalysis={onTrigger} />,
    );

    expect(screen.getByTestId('design-feedback-panel')).toBeInTheDocument();
    expect(screen.getByText('Event-Driven Microservices')).toBeInTheDocument();
    expect(screen.getByText('High write throughput via queue decoupling')).toBeInTheDocument();
    expect(screen.getByText('Database replication lag')).toBeInTheDocument();
    expect(screen.getByText(/Analyze Canvas/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Analyze Canvas/i));
    expect(onTrigger).toHaveBeenCalled();
  });

  it('renders CanvasTimelapse with snapshot buttons and time-lapse replay', () => {
    const snapshots = [
      {
        id: 's-1',
        sessionId: 'sess-1',
        imageUrl: 'data:image/svg+xml;utf8,1',
        elapsedSeconds: 60,
        createdAt: new Date().toISOString(),
      },
      {
        id: 's-2',
        sessionId: 'sess-1',
        imageUrl: 'data:image/svg+xml;utf8,2',
        elapsedSeconds: 180,
        createdAt: new Date().toISOString(),
      },
    ];
    const onSelect = vi.fn();

    render(<CanvasTimelapse snapshots={snapshots} activeIdx={null} onSelectSnapshot={onSelect} />);

    expect(screen.getByTestId('canvas-timelapse')).toBeInTheDocument();
    expect(screen.getByText(/Snapshot 1 \(1:00\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Snapshot 2 \(3:00\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Snapshot 1 \(1:00\)/i));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('renders DesignEvaluationReport with 5-dimension rubric breakdown', () => {
    const evaluation = {
      id: 'eval-1',
      sessionId: 'sess-1',
      requirementsScore: 8.5,
      highLevelScore: 9.0,
      componentDetailScore: 8.0,
      scalabilityScore: 8.5,
      dataModelScore: 8.0,
      overallScore: 8.4,
      feedback: 'Excellent horizontal scaling strategy with Redis and Kafka.',
      detectedComponents: ['API Gateway', 'PostgreSQL', 'Redis'],
      createdAt: new Date().toISOString(),
    };

    render(<DesignEvaluationReport evaluation={evaluation} />);
    expect(screen.getByTestId('design-evaluation-report')).toBeInTheDocument();
    expect(screen.getByText('8.4')).toBeInTheDocument();
    expect(screen.getByText('Requirements & Scope Formulation')).toBeInTheDocument();
    expect(screen.getByText('High-Level Architectural Topology')).toBeInTheDocument();
    expect(screen.getByText('Scalability, Latency & Resilience')).toBeInTheDocument();
    expect(screen.getByText('Data Modeling & Storage Strategy')).toBeInTheDocument();
    expect(screen.getByText('✓ API Gateway')).toBeInTheDocument();
  });
});
