import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentPalette } from '../features/system-design/ComponentPalette';
import { DesignFeedbackPanel } from '../features/system-design/DesignFeedbackPanel';
import { CanvasTimelapse } from '../features/system-design/CanvasTimelapse';
import { DesignEvaluationReport } from '../features/system-design/DesignEvaluationReport';
import { WhiteboardRoom } from '../features/system-design/WhiteboardRoom';
import { useWhiteboardStore } from '../stores/whiteboard.store';

const mockSaveSnapshot = vi.fn().mockResolvedValue({ version: 2, etag: 'W/"v2-abc"' });
const mockExportDiagram = vi.fn().mockResolvedValue({ version: 1, svgContent: '<svg></svg>' });
const mockAnalyzeCanvas = vi.fn().mockResolvedValue({});
const mockEvaluateDesign = vi.fn().mockResolvedValue({});
const mockSetActiveSnapshotIdx = vi.fn();

vi.mock('../features/system-design/useSystemDesign', () => ({
  useSystemDesign: () => ({
    session: { id: 'sess-test-1', initialPrompt: 'Design Scalable Rate Limiter' },
    isLoadingSession: false,
    snapshots: [],
    activeSnapshotIdx: null,
    setActiveSnapshotIdx: mockSetActiveSnapshotIdx,
    saveSnapshot: mockSaveSnapshot,
    isSavingSnapshot: false,
    analyzeCanvas: mockAnalyzeCanvas,
    isAnalyzing: false,
    analysisResult: null,
    evaluateDesign: mockEvaluateDesign,
    isEvaluating: false,
    evaluation: null,
    exportDiagram: mockExportDiagram,
  }),
}));

describe('System Design Whiteboard Components (F003 & NEW-FUNC-04)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    useWhiteboardStore.setState({
      elements: [],
      connectors: [],
      selectedElementId: null,
      tool: 'select',
      version: 1,
      etag: null,
      isSyncing: false,
      hasPendingSync: false,
      syncConflict: null,
      lastSyncedAt: null,
      syncDebounceTimeout: null,
    });
  });

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
      strengths: ['Good caching', 'Decoupled services'],
      bottlenecks: ['Single DB instance'],
      recommendations: ['Add DB replicas'],
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

  describe('Whiteboard Store Concurrency & Debounced Sync (NEW-FUNC-04)', () => {
    it('debounces auto-sync by 500ms before invoking sync function', async () => {
      vi.useFakeTimers();
      const store = useWhiteboardStore.getState();
      const mockSync = vi.fn().mockResolvedValue({ version: 2, etag: 'W/"v2-abc"' });

      store.addElement({
        id: 'node-1',
        type: 'LOAD_BALANCER',
        label: 'LB 1',
        x: 100,
        y: 100,
        width: 140,
        height: 60,
        color: '#059669',
      });

      store.scheduleDebouncedSync(mockSync);

      // Fast-forward 200ms -> should not have fired yet
      vi.advanceTimersByTime(200);
      expect(mockSync).not.toHaveBeenCalled();

      // Another edit comes in at 300ms -> resets timer
      store.addElement({
        id: 'node-2',
        type: 'MICROSERVICE',
        label: 'Service 1',
        x: 300,
        y: 100,
        width: 150,
        height: 60,
        color: '#d97706',
      });
      store.scheduleDebouncedSync(mockSync);

      // Fast-forward 300ms (total 500ms from start, 300ms from 2nd edit) -> still not fired
      vi.advanceTimersByTime(300);
      expect(mockSync).not.toHaveBeenCalled();

      // Fast-forward remaining 200ms (total 500ms from 2nd edit) -> fires exactly once
      vi.advanceTimersByTime(200);
      await Promise.resolve(); // flush microtasks

      expect(mockSync).toHaveBeenCalledTimes(1);
      expect(mockSync).toHaveBeenCalledWith(
        expect.objectContaining({
          elements: expect.arrayContaining([
            expect.objectContaining({ id: 'node-1' }),
            expect.objectContaining({ id: 'node-2' }),
          ]),
        }),
      );
    });

    it('correctly tracks version increments on node additions and removals', () => {
      const store = useWhiteboardStore.getState();
      expect(store.version).toBe(1);

      store.addElement({
        id: 'node-db',
        type: 'RELATIONAL_DB',
        label: 'PostgreSQL',
        x: 500,
        y: 200,
        width: 160,
        height: 60,
        color: '#2563eb',
      });

      expect(useWhiteboardStore.getState().version).toBe(2);
      expect(useWhiteboardStore.getState().elements.length).toBe(1);

      store.removeElement('node-db');
      expect(useWhiteboardStore.getState().version).toBe(3);
      expect(useWhiteboardStore.getState().elements.length).toBe(0);
    });

    it('hydrates initial state cleanly without incrementing version', () => {
      const store = useWhiteboardStore.getState();
      const mockElements = [
        {
          id: 'el-1',
          type: 'CLIENT',
          label: 'Client',
          x: 20,
          y: 20,
          width: 140,
          height: 48,
          color: '#4f46e5',
        },
      ];
      const mockConnectors = [{ id: 'conn-1', fromId: 'el-1', toId: 'el-2', protocol: 'HTTPS' }];

      store.setInitialState(mockElements, mockConnectors, 5, 'W/"v5-hash"');

      const updated = useWhiteboardStore.getState();
      expect(updated.elements).toHaveLength(1);
      expect(updated.connectors).toHaveLength(1);
      expect(updated.version).toBe(5);
      expect(updated.etag).toBe('W/"v5-hash"');
    });

    it('moves elements and updates element properties correctly', () => {
      const store = useWhiteboardStore.getState();
      store.addElement({
        id: 'node-svc',
        type: 'MICROSERVICE',
        label: 'Service A',
        x: 100,
        y: 100,
        width: 150,
        height: 48,
        color: '#0f766e',
      });

      store.moveElement('node-svc', 250, 180);
      const moved = useWhiteboardStore.getState().elements.find(el => el.id === 'node-svc');
      expect(moved?.x).toBe(250);
      expect(moved?.y).toBe(180);

      store.updateElement('node-svc', { label: 'Auth Microservice', color: '#4f46e5' });
      const updated = useWhiteboardStore.getState().elements.find(el => el.id === 'node-svc');
      expect(updated?.label).toBe('Auth Microservice');
      expect(updated?.color).toBe('#4f46e5');
    });
  });

  describe('WhiteboardRoom Component User Interactivity (NEW-FUNC-04 Fixes)', () => {
    it('renders WhiteboardRoom with initial workspace and toolbar controls', () => {
      useWhiteboardStore.setState({
        elements: [
          {
            id: 'el-client',
            type: 'CLIENT',
            label: 'Client App',
            x: 50,
            y: 100,
            width: 140,
            height: 48,
            color: '#4f46e5',
          },
        ],
        connectors: [],
      });

      render(<WhiteboardRoom interviewId="sess-test-1" />);

      expect(screen.getByTestId('whiteboard-room')).toBeInTheDocument();
      expect(screen.getByText('Design Scalable Rate Limiter')).toBeInTheDocument();
      expect(screen.getByText('Client App')).toBeInTheDocument();
      expect(screen.getByText('Select & Move')).toBeInTheDocument();
      expect(screen.getByText('Connect')).toBeInTheDocument();
      expect(screen.getByText('Boundary Box')).toBeInTheDocument();
      expect(screen.getByText('Pen')).toBeInTheDocument();
    });

    it('allows selecting an element and editing its label via property inspector', () => {
      useWhiteboardStore.setState({
        elements: [
          {
            id: 'el-api',
            type: 'MICROSERVICE',
            label: 'Rate Limiter API',
            x: 100,
            y: 100,
            width: 150,
            height: 48,
            color: '#0f766e',
          },
        ],
      });

      render(<WhiteboardRoom interviewId="sess-test-1" />);

      const elNode = screen.getByText('Rate Limiter API');
      fireEvent.pointerDown(elNode);

      // Property inspector opens
      const input = screen.getByPlaceholderText('Component name...');
      expect(input).toBeInTheDocument();

      fireEvent.change(input, { target: { value: 'Token Bucket Limiter' } });
      expect(useWhiteboardStore.getState().elements[0].label).toBe('Token Bucket Limiter');
    });

    it('allows changing element color and deleting via inspector button', () => {
      useWhiteboardStore.setState({
        elements: [
          {
            id: 'el-cache',
            type: 'CACHE',
            label: 'Redis Store',
            x: 200,
            y: 150,
            width: 140,
            height: 48,
            color: '#ea580c',
          },
        ],
        selectedElementId: 'el-cache',
      });

      render(<WhiteboardRoom interviewId="sess-test-1" />);

      // Palette color change
      const blueButton = screen.getByTitle('Blue');
      fireEvent.click(blueButton);
      expect(useWhiteboardStore.getState().elements[0].color).toBe('#2563eb');

      // Delete action
      const deleteBtn = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteBtn);
      expect(useWhiteboardStore.getState().elements).toHaveLength(0);
    });

    it('supports connecting two components using the Connect tool', () => {
      useWhiteboardStore.setState({
        elements: [
          {
            id: 'el-from',
            type: 'CLIENT',
            label: 'Client Node',
            x: 40,
            y: 100,
            width: 140,
            height: 48,
            color: '#4f46e5',
          },
          {
            id: 'el-to',
            type: 'LOAD_BALANCER',
            label: 'Gateway Node',
            x: 250,
            y: 100,
            width: 140,
            height: 48,
            color: '#059669',
          },
        ],
        connectors: [],
      });

      render(<WhiteboardRoom interviewId="sess-test-1" />);

      // Switch to Connect (Arrow) tool
      fireEvent.click(screen.getByText('Connect'));

      // Click source element then target element
      fireEvent.pointerDown(screen.getByText('Client Node'));
      fireEvent.pointerDown(screen.getByText('Gateway Node'));

      // Connector is created
      const conns = useWhiteboardStore.getState().connectors;
      expect(conns.length).toBeGreaterThanOrEqual(1);
      expect(conns[0].fromId).toBe('el-from');
      expect(conns[0].toId).toBe('el-to');
    });

    it('creates boundary box when Boundary Box tool is used on canvas', () => {
      useWhiteboardStore.setState({ elements: [], connectors: [] });

      render(<WhiteboardRoom interviewId="sess-test-1" />);

      // Switch to Boundary Box tool
      fireEvent.click(screen.getByText('Boundary Box'));

      // Click on canvas
      const canvasArea = screen.getByTestId('whiteboard-canvas-area');
      fireEvent.pointerDown(canvasArea, { clientX: 300, clientY: 200 });

      const elems = useWhiteboardStore.getState().elements;
      expect(elems.some(e => e.type === 'BOUNDARY_BOX')).toBe(true);
    });
  });
});
