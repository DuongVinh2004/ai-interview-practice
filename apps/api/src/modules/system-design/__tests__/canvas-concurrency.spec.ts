import { Test, TestingModule } from '@nestjs/testing';
import { CanvasService } from '../services/canvas.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ErrorCode } from '@ai-interview/contracts';
import { HttpStatus } from '@nestjs/common';

describe('Whiteboard Canvas Concurrency & Architecture Nodes (NEW-FUNC-04)', () => {
  let service: CanvasService;
  let mockPrisma: any;

  const sampleElements = [
    {
      id: 'node-lb',
      type: 'LOAD_BALANCER',
      label: 'Nginx LB',
      x: 100,
      y: 200,
      width: 140,
      height: 60,
      color: '#059669',
      properties: { algorithm: 'round-robin', capacity: '50k rps' },
    },
    {
      id: 'node-svc',
      type: 'MICROSERVICE',
      label: 'Order Service',
      x: 320,
      y: 200,
      width: 150,
      height: 60,
      color: '#d97706',
      properties: { instances: 4, framework: 'NestJS' },
    },
    {
      id: 'node-db',
      type: 'RELATIONAL_DB',
      label: 'PostgreSQL Primary',
      x: 550,
      y: 200,
      width: 160,
      height: 60,
      color: '#2563eb',
      properties: { engine: 'PostgreSQL 16', storage: '500GB SSD' },
    },
    {
      id: 'node-cache',
      type: 'CACHE',
      label: 'Redis Cluster',
      x: 320,
      y: 340,
      width: 140,
      height: 60,
      color: '#ea580c',
      properties: { ttl: 3600, eviction: 'allkeys-lru' },
    },
    {
      id: 'node-queue',
      type: 'MESSAGE_QUEUE',
      label: 'Kafka Events',
      x: 550,
      y: 340,
      width: 150,
      height: 60,
      color: '#e11d48',
      properties: { topics: ['orders', 'notifications'], partitions: 12 },
    },
  ];

  const sampleConnectors = [
    {
      id: 'conn-1',
      fromId: 'node-lb',
      toId: 'node-svc',
      protocol: 'HTTP/2',
      label: 'Forward Request',
      properties: { timeoutMs: 5000 },
    },
    {
      id: 'conn-2',
      fromId: 'node-svc',
      toId: 'node-db',
      protocol: 'TCP/SQL',
      label: 'Read/Write',
      properties: { poolSize: 20 },
    },
    {
      id: 'conn-3',
      fromId: 'node-svc',
      toId: 'node-cache',
      protocol: 'RESP',
      label: 'Cache Get/Set',
    },
    {
      id: 'conn-4',
      fromId: 'node-svc',
      toId: 'node-queue',
      protocol: 'Kafka Protocol',
      label: 'Publish Event',
    },
  ];

  beforeEach(async () => {
    mockPrisma = {
      interviewSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'int-concurrency-123',
          userId: 'user-cand-123',
        }),
      },
      systemDesignSession: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      canvasSnapshot: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CanvasService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<CanvasService>(CanvasService);
  });

  describe('Optimistic Concurrency & ETag Conflict Detection', () => {
    it('saves snapshot and generates monotonic version and ETag', async () => {
      mockPrisma.systemDesignSession.findUnique.mockResolvedValue({
        id: 'sd-sess-1',
        interviewId: 'int-concurrency-123',
        snapshots: [],
      });

      mockPrisma.canvasSnapshot.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 'snap-1',
          ...data,
          createdAt: new Date(),
        });
      });

      const snapshot = await service.saveSnapshot(
        'user-cand-123',
        'int-concurrency-123',
        'data:image/svg+xml;utf8,<svg></svg>',
        { elements: sampleElements, connectors: sampleConnectors },
        15,
      );

      expect(snapshot.version).toBe(1);
      expect(snapshot.etag).toMatch(/^W\/"v1-[a-f0-9]+"/);
      expect(mockPrisma.canvasSnapshot.create).toHaveBeenCalled();
    });

    it('rejects update when expectedVersion does not match current version (conflict)', async () => {
      mockPrisma.systemDesignSession.findUnique.mockResolvedValue({
        id: 'sd-sess-1',
        interviewId: 'int-concurrency-123',
        snapshots: [
          {
            id: 'snap-prev',
            canvasStateJson: {
              version: 3,
              etag: 'W/"v3-abc12345"',
              elements: [],
            },
          },
        ],
      });

      await expect(
        service.saveSnapshot(
          'user-cand-123',
          'int-concurrency-123',
          'data:image/svg+xml;utf8,<svg></svg>',
          { elements: sampleElements },
          30,
          2, // Client expects version 2, but current is 3
        ),
      ).rejects.toThrow(DomainException);

      try {
        await service.saveSnapshot(
          'user-cand-123',
          'int-concurrency-123',
          'data:image/svg+xml;utf8,<svg></svg>',
          { elements: sampleElements },
          30,
          2,
        );
      } catch (err: any) {
        expect(err.code).toBe(ErrorCode.IDEMPOTENCY_CONFLICT);
        expect(err.status).toBe(HttpStatus.CONFLICT);
      }
    });

    it('rejects update when ifMatchEtag does not match current ETag', async () => {
      mockPrisma.systemDesignSession.findUnique.mockResolvedValue({
        id: 'sd-sess-1',
        interviewId: 'int-concurrency-123',
        snapshots: [
          {
            id: 'snap-prev',
            canvasStateJson: {
              version: 2,
              etag: 'W/"v2-real-etag-123"',
              elements: [],
            },
          },
        ],
      });

      await expect(
        service.saveSnapshot(
          'user-cand-123',
          'int-concurrency-123',
          'data:image/svg+xml;utf8,<svg></svg>',
          { elements: sampleElements },
          45,
          undefined,
          'W/"v2-stale-etag-999"',
        ),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('Architecture Nodes & Export SVG Representation', () => {
    it('normalizes coordinates and metadata for all standard architecture components', async () => {
      let savedData: any = null;
      mockPrisma.systemDesignSession.findUnique.mockResolvedValue({
        id: 'sd-sess-1',
        interviewId: 'int-concurrency-123',
        snapshots: [],
      });

      mockPrisma.canvasSnapshot.create.mockImplementation(({ data }: any) => {
        savedData = data;
        return Promise.resolve({
          id: 'snap-arch-1',
          ...data,
          createdAt: new Date(),
        });
      });

      await service.saveSnapshot(
        'user-cand-123',
        'int-concurrency-123',
        'data:image/svg+xml;utf8,<svg></svg>',
        { elements: sampleElements, connectors: sampleConnectors },
        60,
      );

      expect(savedData).toBeDefined();
      const state = savedData.canvasStateJson;
      expect(state.elements.length).toBe(5);
      expect(state.connectors.length).toBe(4);

      // Verify node types and coordinates
      const lb = state.elements.find((e: any) => e.type === 'LOAD_BALANCER');
      const svc = state.elements.find((e: any) => e.type === 'MICROSERVICE');
      const db = state.elements.find((e: any) => e.type === 'RELATIONAL_DB');
      const cache = state.elements.find((e: any) => e.type === 'CACHE');
      const queue = state.elements.find((e: any) => e.type === 'MESSAGE_QUEUE');

      expect(lb.x).toBe(100);
      expect(lb.y).toBe(200);
      expect(svc.x).toBe(320);
      expect(db.x).toBe(550);
      expect(cache.y).toBe(340);
      expect(queue.y).toBe(340);
      expect(queue.properties.topics).toContain('orders');
    });

    it('exports complete diagram SVG with connectors, nodes, and ETag', async () => {
      mockPrisma.systemDesignSession.findUnique.mockResolvedValue({
        id: 'sd-sess-1',
        interviewId: 'int-concurrency-123',
        initialPrompt: 'Design Scalable Notification Service',
        finalCanvasUrl: 'data:image/svg+xml;utf8,<svg></svg>',
        snapshots: [
          {
            id: 'snap-latest',
            canvasStateJson: {
              version: 4,
              etag: 'W/"v4-hash123"',
              elements: sampleElements,
              connectors: sampleConnectors,
            },
          },
        ],
      });

      const exportResult = await service.exportDiagram(
        'user-cand-123',
        'int-concurrency-123',
        'svg',
      );

      expect(exportResult.interviewId).toBe('int-concurrency-123');
      expect(exportResult.version).toBe(4);
      expect(exportResult.etag).toBe('W/"v4-hash123"');
      expect(exportResult.nodesCount).toBe(5);
      expect(exportResult.connectorsCount).toBe(4);
      expect(exportResult.svgContent).toContain('<svg');
      expect(exportResult.svgContent).toContain('Nginx LB');
      expect(exportResult.svgContent).toContain('Order Service');
      expect(exportResult.svgContent).toContain('PostgreSQL Primary');
      expect(exportResult.svgContent).toContain('Redis Cluster');
      expect(exportResult.svgContent).toContain('Kafka Events');
      expect(exportResult.svgContent).toContain('marker-end="url(#arrowhead)"');
    });
  });
});
