import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';

export interface AntiCheatReport {
  sessionId: string;
  isSuspicious: boolean;
  riskScore: number; // 0 to 100
  flags: Array<{
    ruleId: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    metadata?: Record<string, unknown>;
  }>;
  analyzedAt: string;
}

@Injectable()
export class ArenaAntiCheatService {
  private readonly logger = new Logger(ArenaAntiCheatService.name);

  constructor(private readonly prisma: PrismaService) {}

  async analyzeSession(sessionId: string): Promise<AntiCheatReport> {
    const session = await this.prisma.arenaSession.findUnique({
      where: { id: sessionId },
      include: {
        actionEvents: { orderBy: { sequence: 'asc' } },
        executionRuns: { orderBy: { createdAt: 'asc' } },
        challengeVersion: {
          include: { challenge: true },
        },
      },
    });

    if (!session) {
      return {
        sessionId,
        isSuspicious: false,
        riskScore: 0,
        flags: [],
        analyzedAt: new Date().toISOString(),
      };
    }

    const flags: AntiCheatReport['flags'] = [];
    let riskScore = 0;

    const actionEvents = session.actionEvents || [];
    const executionRuns = session.executionRuns || [];
    const challenge = session.challengeVersion.challenge;

    // 1. Check for Unnatural Completion Speed
    if (session.startedAt && session.submittedAt) {
      const durationSeconds =
        (new Date(session.submittedAt).getTime() - new Date(session.startedAt).getTime()) / 1000;
      if (challenge.difficulty >= 3 && durationSeconds < 180 && executionRuns.length === 0) {
        flags.push({
          ruleId: 'UNNATURAL_COMPLETION_SPEED',
          description: `Difficulty ${challenge.difficulty} challenge completed in ${Math.round(durationSeconds)}s without running tests.`,
          severity: 'HIGH',
          metadata: {
            durationSeconds,
            difficulty: challenge.difficulty,
            testRunsCount: executionRuns.length,
          },
        });
        riskScore += 50;
      }
    }

    // 2. Check for Burst Paste Events
    for (const evt of actionEvents) {
      const metadata = (evt.metadata as any) || {};
      if (metadata.pastedCharCount && metadata.pastedCharCount > 500) {
        flags.push({
          ruleId: 'BURST_PASTE_DETECTED',
          description: `Large burst paste event detected (${metadata.pastedCharCount} characters inserted at once).`,
          severity: 'MEDIUM',
          metadata: { pastedCharCount: metadata.pastedCharCount, sequence: evt.sequence },
        });
        riskScore += 30;
      }
    }

    // 3. Check for Zero Test Run Submission on Complex Challenges
    if (challenge.difficulty >= 4 && executionRuns.length === 0) {
      flags.push({
        ruleId: 'ZERO_INTERMEDIATE_TEST_RUNS',
        description:
          'Candidate submitted high-difficulty solution without executing test suite once.',
        severity: 'LOW',
        metadata: { difficulty: challenge.difficulty },
      });
      riskScore += 15;
    }

    const normalizedRiskScore = Math.min(100, riskScore);
    const isSuspicious = normalizedRiskScore >= 60;

    if (isSuspicious) {
      this.logger.warn(
        `Session ${sessionId} flagged as suspicious with risk score ${normalizedRiskScore} (${flags.length} flags triggered)`,
      );
    }

    return {
      sessionId,
      isSuspicious,
      riskScore: normalizedRiskScore,
      flags,
      analyzedAt: new Date().toISOString(),
    };
  }
}
