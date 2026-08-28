import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  ArenaSessionLifecycleState,
  ArenaSandboxModeEnum,
  ArenaAiAssistanceModeEnum,
  ArenaRunStatusEnum,
  ArenaActionEventTypeEnum,
  Prisma,
} from '@prisma/client';
import {
  ArenaScoreBreakdown,
  ArenaSkillEvidenceDto,
  ArenaTestResult,
} from '@ai-interview/contracts';

@Injectable()
export class ArenaSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(data: {
    userId: string;
    challengeVersionId: string;
    workspaceHandle: string;
    sandboxMode?: ArenaSandboxModeEnum;
    aiAssistanceMode?: ArenaAiAssistanceModeEnum;
    expiresAt?: Date;
  }) {
    return this.prisma.arenaSession.create({
      data: {
        userId: data.userId,
        challengeVersionId: data.challengeVersionId,
        workspaceHandle: data.workspaceHandle,
        state: ArenaSessionLifecycleState.CREATED,
        sandboxMode: data.sandboxMode ?? ArenaSandboxModeEnum.STAGE_A_MOCK,
        aiAssistanceMode: data.aiAssistanceMode ?? ArenaAiAssistanceModeEnum.HINTS_ONLY,
        expiresAt: data.expiresAt ?? null,
      },
      include: {
        challengeVersion: {
          include: { challenge: true },
        },
      },
    });
  }

  async findSessionById(sessionId: string, userId: string) {
    return this.prisma.arenaSession.findFirst({
      where: {
        id: sessionId,
        userId, // Strict ownership check
      },
      include: {
        challengeVersion: {
          include: { challenge: true },
        },
        executionRuns: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        submissions: {
          orderBy: { createdAt: 'desc' },
          include: {
            evaluations: true,
          },
        },
      },
    });
  }

  async updateSessionState(
    sessionId: string,
    userId: string,
    targetState: ArenaSessionLifecycleState,
    additionalData?: {
      submittedAt?: Date;
      completedAt?: Date;
    },
  ) {
    return this.prisma.arenaSession.updateMany({
      where: {
        id: sessionId,
        userId,
      },
      data: {
        state: targetState,
        ...(additionalData?.submittedAt ? { submittedAt: additionalData.submittedAt } : {}),
        ...(additionalData?.completedAt ? { completedAt: additionalData.completedAt } : {}),
      },
    });
  }

  async recordActionEvent(data: {
    sessionId: string;
    eventType: ArenaActionEventTypeEnum;
    metadata?: Record<string, unknown>;
    artifactRef?: string;
    traceId?: string;
  }) {
    const lastEvent = await this.prisma.arenaActionEvent.findFirst({
      where: { sessionId: data.sessionId },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    });

    const sequence = (lastEvent?.sequence ?? 0) + 1;

    return this.prisma.arenaActionEvent.create({
      data: {
        sessionId: data.sessionId,
        eventType: data.eventType,
        sequence,
        metadata: (data.metadata ?? {}) as unknown as Prisma.InputJsonValue,
        artifactRef: data.artifactRef ?? null,
        traceId: data.traceId ?? null,
      },
    });
  }

  async createExecutionRun(data: {
    sessionId: string;
    idempotencyKey?: string;
    commandId: string;
    status: ArenaRunStatusEnum;
    exitCode?: number;
    stdout: string;
    stderr: string;
    durationMs: number;
    testsTotal: number;
    testsPassed: number;
    testsFailed: number;
    testResults: ArenaTestResult[];
    workspaceSnapshotHash?: string;
  }) {
    return this.prisma.arenaExecutionRun.create({
      data: {
        sessionId: data.sessionId,
        idempotencyKey: data.idempotencyKey ?? null,
        commandId: data.commandId,
        status: data.status,
        exitCode: data.exitCode ?? null,
        stdout: data.stdout,
        stderr: data.stderr,
        durationMs: data.durationMs,
        testsTotal: data.testsTotal,
        testsPassed: data.testsPassed,
        testsFailed: data.testsFailed,
        testResultsJson: data.testResults as unknown as Prisma.InputJsonValue,
        workspaceSnapshotHash: data.workspaceSnapshotHash ?? null,
      },
    });
  }

  async createSubmissionWithEvaluation(data: {
    sessionId: string;
    userId: string;
    snapshotHash: string;
    diffArtifactRef?: string;
    explanation?: string;
    scoreBreakdown: ArenaScoreBreakdown;
    aiFeedbackSummary: string;
    rubricCriteriaFeedback: Array<{
      key: string;
      name: string;
      score: number;
      maxPoints: number;
      feedback: string;
    }>;
    skillEvidences: ArenaSkillEvidenceDto[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.arenaSubmission.create({
        data: {
          sessionId: data.sessionId,
          snapshotHash: data.snapshotHash,
          diffArtifactRef: data.diffArtifactRef ?? null,
          explanation: data.explanation ?? null,
          version: 1,
        },
      });

      const evaluation = await tx.arenaEvaluation.create({
        data: {
          submissionId: submission.id,
          objectiveScore: data.scoreBreakdown.objectiveScore,
          rubricScore: data.scoreBreakdown.rubricScore,
          finalScore: data.scoreBreakdown.finalScore,
          scoreCapApplied: data.scoreBreakdown.scoreCapApplied,
          scoreCapReason: data.scoreBreakdown.scoreCapReason ?? null,
          scoreBreakdownJson: data.scoreBreakdown as unknown as Prisma.InputJsonValue,
          aiFeedbackSummary: data.aiFeedbackSummary,
          rubricFeedbackJson: data.rubricCriteriaFeedback as unknown as Prisma.InputJsonValue,
          rubricVersion: '1.0',
          evaluatorPromptVersion: '1.0',
          confidence: 1.0,
        },
      });

      if (data.skillEvidences.length > 0) {
        await tx.arenaSkillEvidence.createMany({
          data: data.skillEvidences.map((evidence) => ({
            evaluationId: evaluation.id,
            userId: data.userId,
            taxonomyKey: evidence.taxonomyKey,
            evidenceType: evidence.evidenceType,
            scoreContribution: evidence.scoreContribution,
            confidence: evidence.confidence,
            sourceSummary: evidence.sourceSummary,
          })),
        });
      }

      await tx.arenaSession.update({
        where: { id: data.sessionId },
        data: {
          state: ArenaSessionLifecycleState.COMPLETED,
          submittedAt: new Date(),
          completedAt: new Date(),
        },
      });

      return { submission, evaluation };
    });
  }
}
