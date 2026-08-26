import { Test, TestingModule } from '@nestjs/testing';
import { DesignEvaluationService } from '../services/design-evaluation.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { MockVisionProvider } from '../providers/mock-vision.provider';

describe('DesignEvaluationService.evaluateDiagram (Module B5)', () => {
  let service: DesignEvaluationService;

  const mockPrisma = {
    interviewSession: {
      findUnique: jest.fn().mockResolvedValue({ id: 'int-123', userId: 'user-123' }),
    },
    systemDesignSession: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'sys-session-1',
        interviewId: 'int-123',
        initialPrompt: 'Design Distributed Messaging Queue',
      }),
    },
    canvasSnapshot: {
      create: jest.fn().mockResolvedValue({ id: 'snap-1' }),
    },
    designEvaluation: {
      upsert: jest.fn().mockResolvedValue({
        id: 'eval-1',
        sessionId: 'sys-session-1',
        overallScore: 8.5,
        requirementsScore: 8.5,
        highLevelScore: 9.0,
        componentDetailScore: 8.0,
        scalabilityScore: 8.5,
        dataModelScore: 8.5,
        feedback: 'Great architecture design.',
        createdAt: new Date(),
      }),
    },
  };

  const mockVisionProvider = new MockVisionProvider();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesignEvaluationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'VISION_PROVIDER', useValue: mockVisionProvider },
      ],
    }).compile();

    service = module.get<DesignEvaluationService>(DesignEvaluationService);
    jest.clearAllMocks();
  });

  it('evaluates diagram on-demand and saves evaluation with visual annotations', async () => {
    const result = await service.evaluateDiagram('user-123', 'int-123', {
      imageUrl: 'data:image/png;base64,mock',
      language: 'vi',
    });

    expect(result.id).toBe('eval-1');
    expect(result.overallScore).toBe(8.5);
    expect(result.annotations).toBeDefined();
    expect(result.annotations.length).toBeGreaterThan(0);
    expect(mockPrisma.canvasSnapshot.create).toHaveBeenCalled();
    expect(mockPrisma.designEvaluation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: 'sys-session-1' },
      }),
    );
  });
});
