import { Test, TestingModule } from '@nestjs/testing';
import { CanvasService } from '../services/canvas.service';
import { DesignAnalyzerService } from '../services/design-analyzer.service';
import { DesignEvaluationService } from '../services/design-evaluation.service';
import { MockVisionProvider } from '../providers/mock-vision.provider';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { VisionEntitlementService } from '../services/vision-entitlement.service';

describe('System Design BOLA / Ownership Enforcement (P1-002)', () => {
  let canvasService: CanvasService;
  let analyzerService: DesignAnalyzerService;
  let evaluationService: DesignEvaluationService;

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
    jest.clearAllMocks();
  });

  const ownerUserId = 'user-owner-123';
  const attackerUserId = 'user-attacker-456';
  const interviewId = 'interview-target-789';

  describe('CanvasService ownership', () => {
    it('throws ForbiddenException when non-owner attempts to initSession', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: interviewId,
        userId: ownerUserId,
      });

      await expect(
        canvasService.initSession(attackerUserId, interviewId, 'Malicious prompt'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when non-owner attempts to saveSnapshot', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: interviewId,
        userId: ownerUserId,
      });

      await expect(
        canvasService.saveSnapshot(
          attackerUserId,
          interviewId,
          'data:image/png;base64,data',
          {},
          10,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when non-owner attempts to getSnapshotHistory', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: interviewId,
        userId: ownerUserId,
      });

      await expect(canvasService.getSnapshotHistory(attackerUserId, interviewId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when non-owner attempts to getSession', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: interviewId,
        userId: ownerUserId,
      });

      await expect(canvasService.getSession(attackerUserId, interviewId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('DesignAnalyzerService & DesignEvaluationService ownership', () => {
    it('throws ForbiddenException when non-owner attempts to analyzeSnapshot', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: interviewId,
        userId: ownerUserId,
      });

      await expect(
        analyzerService.analyzeSnapshot(attackerUserId, interviewId, 'data:image/png;base64,data'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when non-owner attempts to evaluateSession', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: interviewId,
        userId: ownerUserId,
      });

      await expect(evaluationService.evaluateSession(attackerUserId, interviewId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
