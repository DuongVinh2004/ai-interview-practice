import { Test, TestingModule } from '@nestjs/testing';
import { CanvasService } from './services/canvas.service';
import { DesignAnalyzerService } from './services/design-analyzer.service';
import { DesignEvaluationService } from './services/design-evaluation.service';
import { MockVisionProvider } from './providers/mock-vision.provider';
import { PrismaService } from '../platform/prisma/prisma.service';
import { VisionEntitlementService } from './services/vision-entitlement.service';

describe('SystemDesign Services (F003)', () => {
  let canvasService: CanvasService;
  let analyzerService: DesignAnalyzerService;
  let evaluationService: DesignEvaluationService;
  let visionProvider: MockVisionProvider;

  const mockPrisma = {
    interviewSession: {
      findUnique: jest.fn(),
    },
    systemDesignSession: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    canvasSnapshot: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    designEvaluation: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanvasService,
        DesignAnalyzerService,
        DesignEvaluationService,
        MockVisionProvider,
        { provide: 'VISION_PROVIDER', useClass: MockVisionProvider },
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: VisionEntitlementService,
          useValue: { evaluate: jest.fn(input => input.provider.evaluateDiagram(input.options)) },
        },
      ],
    }).compile();

    canvasService = module.get<CanvasService>(CanvasService);
    analyzerService = module.get<DesignAnalyzerService>(DesignAnalyzerService);
    evaluationService = module.get<DesignEvaluationService>(DesignEvaluationService);
    visionProvider = module.get<MockVisionProvider>(MockVisionProvider);
    jest.clearAllMocks();
  });

  describe('Canvas Session Lifecycle', () => {
    it('initializes a system design whiteboard session', async () => {
      const interviewId = 'int-123';
      const userId = 'user-123';
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: interviewId,
        userId,
      });
      mockPrisma.systemDesignSession.upsert.mockResolvedValue({
        id: 'sd-123',
        interviewId,
        initialPrompt: 'Design a URL Shortener',
        snapshots: [],
        evaluation: null,
      });

      const session = await canvasService.initSession(
        userId,
        interviewId,
        'Design a URL Shortener',
      );
      expect(session.id).toBe('sd-123');
      expect(session.initialPrompt).toBe('Design a URL Shortener');
    });

    it('persists a canvas snapshot and updates latest canvas URL', async () => {
      const interviewId = 'int-123';
      const userId = 'user-123';
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: interviewId,
        userId,
      });
      mockPrisma.systemDesignSession.findUnique.mockResolvedValue({
        id: 'sd-123',
        interviewId,
      });
      mockPrisma.canvasSnapshot.create.mockResolvedValue({
        id: 'snap-1',
        sessionId: 'sd-123',
        imageUrl: 'data:image/png;base64,sample',
        elapsedSeconds: 120,
        createdAt: new Date(),
      });
      mockPrisma.systemDesignSession.update.mockResolvedValue({});

      const snapshot = await canvasService.saveSnapshot(
        userId,
        interviewId,
        'data:image/png;base64,sample',
        { elements: [] },
        120,
      );

      expect(snapshot.id).toBe('snap-1');
      expect(snapshot.elapsedSeconds).toBe(120);
      expect(mockPrisma.systemDesignSession.update).toHaveBeenCalledWith({
        where: { id: 'sd-123' },
        data: { finalCanvasUrl: 'data:image/png;base64,sample' },
      });
    });
  });

  describe('Multimodal Vision Analysis', () => {
    it('performs deterministic analysis with detected components and rubric scores', async () => {
      const interviewId = 'int-123';
      const userId = 'user-123';
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: interviewId,
        userId,
      });
      mockPrisma.systemDesignSession.findUnique.mockResolvedValue({
        id: 'sd-123',
        interviewId,
        snapshots: [{ id: 'snap-1', imageUrl: 'data:image/png;base64,test' }],
      });
      mockPrisma.canvasSnapshot.update.mockResolvedValue({});

      const analysis = await analyzerService.analyzeSnapshot(
        userId,
        interviewId,
        'data:image/png;base64,test',
        undefined,
        'vision-analyze-1',
      );
      expect(
        analysis.detectedComponents.some(component => component.includes('Load Balancer')),
      ).toBe(true);
      expect(analysis.detectedComponents.some(component => component.includes('API Gateway'))).toBe(
        true,
      );
      expect(analysis.rubricScores.requirements).toBeGreaterThanOrEqual(8.0);
      expect(analysis.strengths.length).toBeGreaterThan(0);
      expect(analysis.potentialBottlenecks.length).toBeGreaterThan(0);
    });
  });

  describe('5-Dimension Design Rubric Scoring', () => {
    it('calculates weighted composite score correctly across the 5 dimensions', async () => {
      const interviewId = 'int-123';
      const userId = 'user-123';
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: interviewId,
        userId,
      });
      mockPrisma.systemDesignSession.findUnique.mockResolvedValue({
        id: 'sd-123',
        interviewId,
        snapshots: [{ id: 'snap-1', imageUrl: 'data:image/png;base64,test' }],
      });

      mockPrisma.designEvaluation.upsert.mockResolvedValue({
        id: 'eval-1',
        sessionId: 'sd-123',
        requirementsScore: 8.5,
        highLevelScore: 8.5,
        componentDetailScore: 8.0,
        scalabilityScore: 8.5,
        dataModelScore: 8.0,
        overallScore: 8.3,
        feedback: 'Solid distributed design with caching',
        createdAt: new Date(),
      });

      const result = await evaluationService.evaluateSession(
        userId,
        interviewId,
        'vision-evaluate-1',
      );
      expect(result.id).toBe('eval-1');
      expect(result.overallScore).toBe(8.3);
      expect(result.rubricBreakdown).toBeDefined();
      expect(result.rubricBreakdown?.requirements).toContain('8.5/10');
      expect(result.rubricBreakdown?.scalability).toContain('8.5/10');
    });
  });
});
