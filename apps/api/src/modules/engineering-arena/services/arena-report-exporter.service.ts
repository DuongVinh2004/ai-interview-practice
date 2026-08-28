import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ArenaAntiCheatService } from './arena-anti-cheat.service';
import { ArenaPatchExporterService, PatchExportResult } from './arena-patch-exporter.service';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ErrorCode, ArenaChallengeManifest } from '@ai-interview/contracts';

export interface ExecutiveCandidateDossier {
  evaluationId: string;
  candidateId: string;
  challenge: {
    title: string;
    domain: string;
    category: string;
    difficulty: number;
    slug: string;
  };
  scoreSummary: {
    finalScore: number;
    objectiveScore: number;
    rubricScore: number;
    scoreCapApplied: boolean;
    scoreCapReason?: string;
  };
  testResults: {
    visiblePassed: number;
    visibleTotal: number;
    hiddenPassed: number;
    hiddenTotal: number;
  };
  integrityCheck: {
    riskScore: number;
    isSuspicious: boolean;
    flagsCount: number;
  };
  rubricCriteria: Array<{
    key: string;
    name: string;
    score: number;
    maxPoints: number;
    feedback: string;
  }>;
  skillEvidences: Array<{
    taxonomyKey: string;
    scoreContribution: number;
  }>;
  patchSummary: PatchExportResult;
  evaluatedAt: string;
}

@Injectable()
export class ArenaReportExporterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly antiCheatService: ArenaAntiCheatService,
    private readonly patchExporter: ArenaPatchExporterService,
  ) {}

  async exportCandidateDossier(
    evaluationId: string,
    userId: string,
  ): Promise<ExecutiveCandidateDossier> {
    const evaluation = await this.prisma.arenaEvaluation.findUnique({
      where: { id: evaluationId },
      include: {
        submission: {
          include: {
            session: {
              include: {
                challengeVersion: {
                  include: { challenge: true },
                },
              },
            },
          },
        },
      },
    });

    if (!evaluation) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Evaluation '${evaluationId}' not found.`,
        HttpStatus.NOT_FOUND,
      );
    }

    const session = evaluation.submission.session;
    if (session.userId !== userId) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Access denied: You do not own this evaluation report.',
        HttpStatus.FORBIDDEN,
      );
    }

    const challenge = session.challengeVersion.challenge;
    const manifest = session.challengeVersion.manifestJson as unknown as ArenaChallengeManifest;
    const scoreBreakdown = (evaluation.scoreBreakdownJson as any) || {};

    // 1. Run Anti-Cheat analysis
    const antiCheatReport = await this.antiCheatService.analyzeSession(session.id);

    // 2. Generate Git Patch
    const initialFiles: Record<string, string> = {};
    for (const vFile of manifest.visibleFiles || []) {
      initialFiles[vFile] = `// ${vFile} initial boilerplate\n`;
    }
    const finalFiles: Record<string, string> = {};
    for (const eFile of manifest.editableFiles || []) {
      finalFiles[eFile] = `// ${eFile} solution modified\n`;
    }
    const patchSummary = this.patchExporter.generateUnifiedPatch(initialFiles, finalFiles);

    // 3. Fetch Skill Evidences
    const evidences = await this.prisma.arenaSkillEvidence.findMany({
      where: { evaluationId: evaluation.id },
      select: { taxonomyKey: true, scoreContribution: true },
    });

    return {
      evaluationId: evaluation.id,
      candidateId: session.userId,
      challenge: {
        title: challenge.title,
        domain: challenge.domain,
        category: challenge.category,
        difficulty: challenge.difficulty,
        slug: challenge.slug,
      },
      scoreSummary: {
        finalScore: evaluation.finalScore,
        objectiveScore: evaluation.objectiveScore,
        rubricScore: evaluation.rubricScore,
        scoreCapApplied: evaluation.scoreCapApplied,
        scoreCapReason: evaluation.scoreCapReason || undefined,
      },
      testResults: {
        visiblePassed: scoreBreakdown.testsVisiblePassed || 0,
        visibleTotal: scoreBreakdown.testsVisibleTotal || 0,
        hiddenPassed: scoreBreakdown.testsHiddenPassed || 0,
        hiddenTotal: scoreBreakdown.testsHiddenTotal || 0,
      },
      integrityCheck: {
        riskScore: antiCheatReport.riskScore,
        isSuspicious: antiCheatReport.isSuspicious,
        flagsCount: antiCheatReport.flags.length,
      },
      rubricCriteria: ((evaluation.rubricFeedbackJson as any)?.criteriaFeedback || []).map((c: any) => ({
        key: c.key,
        name: c.name,
        score: c.score,
        maxPoints: c.maxPoints,
        feedback: c.feedback,
      })),
      skillEvidences: evidences,
      patchSummary,
      evaluatedAt: evaluation.createdAt.toISOString(),
    };
  }
}
