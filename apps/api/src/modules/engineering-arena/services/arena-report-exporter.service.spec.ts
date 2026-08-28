import { Test, TestingModule } from '@nestjs/testing';
import { ArenaReportExporterService } from './arena-report-exporter.service';
import { ArenaAntiCheatService } from './arena-anti-cheat.service';
import { ArenaPatchExporterService } from './arena-patch-exporter.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

describe('ArenaReportExporterService', () => {
  let service: ArenaReportExporterService;
  let prisma: {
    arenaEvaluation: { findUnique: jest.Mock };
    arenaSkillEvidence: { findMany: jest.Mock };
  };
  let antiCheatService: { analyzeSession: jest.Mock };
  let patchExporter: { generateUnifiedPatch: jest.Mock };

  const mockEvaluation = {
    id: 'eval-1',
    finalScore: 88,
    objectiveScore: 85,
    rubricScore: 90,
    scoreCapApplied: false,
    scoreCapReason: null,
    scoreBreakdownJson: {
      testsVisiblePassed: 4,
      testsVisibleTotal: 4,
      testsHiddenPassed: 3,
      testsHiddenTotal: 3,
    },
    rubricFeedbackJson: {
      criteriaFeedback: [
        { key: 'cleanup', name: 'Cleanup', score: 45, maxPoints: 50, feedback: 'Good' },
      ],
    },
    createdAt: new Date('2026-08-28T12:30:00.000Z'),
    submission: {
      finalFilesJson: { 'src/index.ts': 'export const fixed = true;' },
      session: {
        id: 'sess-1',
        userId: 'user-1',
        challengeVersion: {
          manifestJson: { visibleFiles: ['src/index.ts'] },
          challenge: {
            title: 'Fix Memory Leak',
            domain: 'BACKEND',
            category: 'BUG_FIX',
            difficulty: 3,
            slug: 'fix-memory-leak',
          },
        },
      },
    },
  };

  beforeEach(async () => {
    prisma = {
      arenaEvaluation: { findUnique: jest.fn().mockResolvedValue(mockEvaluation) },
      arenaSkillEvidence: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ taxonomyKey: 'nodejs_memory', scoreContribution: 88 }]),
      },
    };

    antiCheatService = {
      analyzeSession: jest.fn().mockResolvedValue({
        sessionId: 'sess-1',
        isSuspicious: false,
        riskScore: 0,
        flags: [],
      }),
    };

    patchExporter = {
      generateUnifiedPatch: jest.fn().mockReturnValue({
        patch: 'diff --git a/src/index.ts b/src/index.ts\n',
        stats: { additions: 1, deletions: 0, filesChanged: 1 },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArenaReportExporterService,
        { provide: PrismaService, useValue: prisma },
        { provide: ArenaAntiCheatService, useValue: antiCheatService },
        { provide: ArenaPatchExporterService, useValue: patchExporter },
      ],
    }).compile();

    service = module.get<ArenaReportExporterService>(ArenaReportExporterService);
  });

  it('exports complete candidate dossier including score, patch, integrity, and skills', async () => {
    const dossier = await service.exportCandidateDossier('eval-1', 'user-1');

    expect(dossier.evaluationId).toBe('eval-1');
    expect(dossier.candidateId).toBe('user-1');
    expect(dossier.scoreSummary.finalScore).toBe(88);
    expect(dossier.testResults.visiblePassed).toBe(4);
    expect(dossier.integrityCheck.isSuspicious).toBe(false);
    expect(dossier.skillEvidences).toHaveLength(1);
    expect(dossier.patchSummary.stats.filesChanged).toBe(1);
  });

  it('throws Forbidden if user does not own evaluation session', async () => {
    await expect(service.exportCandidateDossier('eval-1', 'other-user')).rejects.toThrow(
      DomainException,
    );
  });
});
