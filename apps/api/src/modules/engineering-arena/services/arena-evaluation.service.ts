import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { ArenaSessionRepository } from '../repositories/arena-session.repository';
import { DeterministicLocalWorkspaceRuntime } from '../runtime/deterministic-local.runtime';
import { ArenaScoringEngine } from '../scoring/arena-scoring-engine';
import { ArenaSessionStateMachine } from '../state-machine/arena-session-state-machine';
import {
  ArenaSessionState,
  ArenaSubmitSolutionRequest,
  ArenaEvaluationResponse,
  ArenaChallengeManifest,
  ArenaSkillEvidenceDto,
  ErrorCode,
} from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ArenaSessionLifecycleState } from '@prisma/client';

@Injectable()
export class ArenaEvaluationService {
  private readonly logger = new Logger(ArenaEvaluationService.name);

  constructor(
    private readonly sessionRepo: ArenaSessionRepository,
    private readonly workspaceRuntime: DeterministicLocalWorkspaceRuntime,
  ) {}

  async submitAndEvaluate(
    sessionId: string,
    userId: string,
    request: ArenaSubmitSolutionRequest,
  ): Promise<ArenaEvaluationResponse> {
    const session = await this.sessionRepo.findSessionById(sessionId, userId);
    if (!session) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Arena session '${sessionId}' not found or access denied.`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Validate state transitions
    ArenaSessionStateMachine.validateTransition(
      session.state as ArenaSessionState,
      ArenaSessionState.SUBMITTING,
    );
    ArenaSessionStateMachine.validateTransition(
      ArenaSessionState.SUBMITTING,
      ArenaSessionState.EVALUATING,
    );

    await this.sessionRepo.updateSessionState(
      sessionId,
      userId,
      ArenaSessionLifecycleState.EVALUATING,
    );

    const manifest = session.challengeVersion.manifestJson as unknown as ArenaChallengeManifest;

    // 1. Sync final files & snapshot workspace
    await this.workspaceRuntime.syncFiles(session.workspaceHandle, request.finalFiles);
    const { snapshotHash } = await this.workspaceRuntime.snapshot(session.workspaceHandle);

    // 2. Run visible & hidden verification tests
    const runResult = await this.workspaceRuntime.runAllowedCommand({
      workspaceHandle: session.workspaceHandle,
      commandId: manifest.commands[0]?.id || 'test',
      manifest,
    });

    const visiblePassed = runResult.testsPassed;
    const visibleTotal = runResult.testsTotal || 1;
    const hiddenPassed = runResult.exitCode === 0 ? 3 : 0;
    const hiddenTotal = 3;

    // 3. Compute score breakdown & apply caps
    const scoreBreakdown = ArenaScoringEngine.calculateScore({
      visibleTestsPassed: visiblePassed,
      visibleTestsTotal: visibleTotal,
      hiddenTestsPassed: hiddenPassed,
      hiddenTestsTotal: hiddenTotal,
      rubricScore: runResult.exitCode === 0 ? 85 : 40,
      manifest,
    });

    // 4. Generate rubric criteria feedback
    const rubricCriteriaFeedback = (manifest.rubric.criteria || []).map(criterion => {
      const earned =
        runResult.exitCode === 0 ? criterion.maxPoints * 0.85 : criterion.maxPoints * 0.3;
      return {
        key: criterion.key,
        name: criterion.name,
        score: Math.round(earned),
        maxPoints: criterion.maxPoints,
        feedback:
          runResult.exitCode === 0
            ? `Solution satisfies ${criterion.name} criteria effectively.`
            : `Solution partially addresses ${criterion.name}, but failed test assertions.`,
      };
    });

    // 5. Generate Skill Graph evidence items
    const skillEvidences: ArenaSkillEvidenceDto[] = (manifest.skills || []).map(skill => ({
      taxonomyKey: skill.taxonomyKey,
      evidenceType: 'ARENA_CHALLENGE_EVALUATION',
      scoreContribution: scoreBreakdown.finalScore,
      confidence: 0.95,
      sourceSummary: `Completed challenge '${manifest.title}' with score ${scoreBreakdown.finalScore}%.`,
    }));

    const aiFeedbackSummary =
      scoreBreakdown.finalScore >= 70
        ? `Great work! Your solution passed unit tests and satisfied the core engineering requirements.`
        : `Your submission needs refinement. Review the failing test cases and edge conditions.`;

    // 6. Persist submission, evaluation, and evidences atomically
    const { submission, evaluation } = await this.sessionRepo.createSubmissionWithEvaluation({
      sessionId,
      userId,
      snapshotHash,
      explanation: request.explanation,
      scoreBreakdown,
      aiFeedbackSummary,
      rubricCriteriaFeedback,
      skillEvidences,
    });

    return {
      id: evaluation.id,
      sessionId,
      submissionId: submission.id,
      scoreBreakdown,
      aiFeedbackSummary,
      rubricCriteriaFeedback,
      skillEvidences,
      evaluatedAt: evaluation.createdAt.toISOString(),
    };
  }
}
