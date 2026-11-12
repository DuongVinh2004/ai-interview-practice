import { Test, TestingModule } from '@nestjs/testing';
import { DesignEvaluationService } from '../../src/modules/system-design/services/design-evaluation.service';
import { MockVisionProvider } from '../../src/modules/system-design/providers/mock-vision.provider';
import { PrismaService } from '../../src/modules/platform/prisma/prisma.service';
import { VisionEntitlementService } from '../../src/modules/system-design/services/vision-entitlement.service';

describe('Vision AI Benchmark Golden Tests (Task 1.5 / PRD-1500)', () => {
  let service: DesignEvaluationService;
  let mockVisionProvider: MockVisionProvider;

  const mockPrisma = {
    interviewSession: {
      findUnique: jest.fn().mockResolvedValue({ id: 'bench-interview-1', userId: 'bench-user-1' }),
    },
    systemDesignSession: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'bench-sys-session-1',
        interviewId: 'bench-interview-1',
        initialPrompt: 'Design a highly available distributed e-commerce backend',
      }),
    },
    canvasSnapshot: {
      create: jest.fn().mockResolvedValue({ id: 'bench-snap-1' }),
    },
    designEvaluation: {
      upsert: jest.fn().mockImplementation((args: any) =>
        Promise.resolve({
          id: 'bench-eval-1',
          sessionId: 'bench-sys-session-1',
          ...args.create,
          createdAt: new Date(),
        }),
      ),
    },
  };

  beforeEach(async () => {
    mockVisionProvider = new MockVisionProvider();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesignEvaluationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'VISION_PROVIDER', useValue: mockVisionProvider },
        {
          provide: VisionEntitlementService,
          useValue: {
            evaluate: jest.fn(input => input.provider.evaluateDiagram(input.options)),
          },
        },
      ],
    }).compile();

    service = module.get<DesignEvaluationService>(DesignEvaluationService);
    jest.clearAllMocks();
  });

  // Benchmark Case 1: Complete diagram (Load Balancer + Service + DB + Cache)
  it('Benchmark 1: Complete diagram with LB, service, DB, cache scores >= 3.5/5 on all rubrics', async () => {
    const canvasData = {
      nodes: [
        { id: '1', type: 'load_balancer', label: 'Ingress Nginx Load Balancer' },
        { id: '2', type: 'service', label: 'Order Processing API Service' },
        { id: '3', type: 'database', label: 'PostgreSQL Primary & Replica DB' },
        { id: '4', type: 'cache', label: 'Redis Distributed Cache' },
      ],
      edges: [
        { from: '1', to: '2' },
        { from: '2', to: '4' },
        { from: '2', to: '3' },
      ],
    };

    const result = await service.evaluateDiagram(
      'bench-user-1',
      'bench-interview-1',
      {
        imageUrl: 'data:image/png;base64,complete_diagram',
        canvasData,
      },
      'bench-idemp-1',
    );

    const scores = result.scores!;
    expect(scores.requirements).toBeGreaterThanOrEqual(3.5);
    expect(scores.highLevelArchitecture).toBeGreaterThanOrEqual(3.5);
    expect(scores.componentDetail).toBeGreaterThanOrEqual(3.5);
    expect(scores.scalability).toBeGreaterThanOrEqual(3.5);
    expect(scores.dataModel).toBeGreaterThanOrEqual(3.5);
  });

  // Benchmark Case 2: Missing database
  it('Benchmark 2: Diagram missing database results in dataModel score <= 2.0', async () => {
    const canvasData = {
      nodes: [
        { id: '1', type: 'load_balancer', label: 'ALB Ingress' },
        { id: '2', type: 'service', label: 'App Web Service' },
        { id: '3', type: 'cache', label: 'Redis Cache' },
      ],
      edges: [{ from: '1', to: '2' }],
    };

    const result = await service.evaluateDiagram(
      'bench-user-1',
      'bench-interview-1',
      {
        imageUrl: 'data:image/png;base64,no_db_diagram',
        canvasData,
      },
      'bench-idemp-2',
    );

    const scores = result.scores!;
    expect(scores.dataModel).toBeLessThanOrEqual(2.0);
  });

  // Benchmark Case 3: Single point of failure
  it('Benchmark 3: Diagram with single point of failure (SPOF) results in scalability score <= 2.5', async () => {
    const canvasData = {
      hasSpof: true,
      nodes: [
        { id: '1', type: 'service', label: 'Single Monolith Instance (SPOF)', hasSpof: true },
        { id: '2', type: 'database', label: 'Standalone Single DB Instance' },
      ],
      edges: [{ from: '1', to: '2' }],
    };

    const result = await service.evaluateDiagram(
      'bench-user-1',
      'bench-interview-1',
      {
        imageUrl: 'data:image/png;base64,spof_diagram',
        canvasData,
      },
      'bench-idemp-3',
    );

    const scores = result.scores!;
    expect(scores.scalability).toBeLessThanOrEqual(2.5);
  });

  // Benchmark Case 4: Empty diagram
  it('Benchmark 4: Empty diagram with no nodes results in all scores <= 1.5', async () => {
    const canvasData = {
      nodes: [],
      edges: [],
    };

    const result = await service.evaluateDiagram(
      'bench-user-1',
      'bench-interview-1',
      {
        imageUrl: 'data:image/png;base64,empty_diagram',
        canvasData,
      },
      'bench-idemp-4',
    );

    const scores = result.scores!;
    expect(scores.requirements).toBeLessThanOrEqual(1.5);
    expect(scores.highLevelArchitecture).toBeLessThanOrEqual(1.5);
    expect(scores.componentDetail).toBeLessThanOrEqual(1.5);
    expect(scores.scalability).toBeLessThanOrEqual(1.5);
    expect(scores.dataModel).toBeLessThanOrEqual(1.5);
  });

  // Benchmark Case 5: Diagram with annotation text describing trade-offs
  it('Benchmark 5: Diagram with annotation text describing trade-offs results in highLevelArchitecture score >= 3.0', async () => {
    const canvasData = {
      nodes: [
        { id: '1', type: 'load_balancer', label: 'Cloudflare CDN & Ingress LB' },
        { id: '2', type: 'service', label: 'Order Processing Service' },
        { id: '3', type: 'database', label: 'PostgreSQL DB' },
      ],
      annotations: [
        {
          id: 'note-1',
          label: 'CAP Theorem Architecture Trade-off',
          text: 'Trade-off: Prioritize Availability and Partition Tolerance (AP) over strict consistency during network splits.',
        },
      ],
    };

    const result = await service.evaluateDiagram(
      'bench-user-1',
      'bench-interview-1',
      {
        imageUrl: 'data:image/png;base64,tradeoff_diagram',
        canvasData,
      },
      'bench-idemp-5',
    );

    const scores = result.scores!;
    expect(scores.highLevelArchitecture).toBeGreaterThanOrEqual(3.0);
  });
});
