import { Injectable, HttpStatus } from '@nestjs/common';
import { ArenaChallengeRepository } from './repositories/arena-challenge.repository';
import { ArenaSessionRepository } from './repositories/arena-session.repository';
import { ArenaSessionStateMachine } from './state-machine/arena-session-state-machine';
import { DeterministicLocalWorkspaceRuntime } from './runtime/deterministic-local.runtime';
import { ArenaEvaluationService } from './services/arena-evaluation.service';
import { ArenaSseService } from './services/arena-sse.service';
import {
  ArenaSessionState,
  ErrorCode,
  StartArenaSessionRequest,
  ArenaChallengeManifest,
  ArenaFileNode,
} from '@ai-interview/contracts';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import {
  ArenaSessionLifecycleState,
  ArenaChallengeDomain,
  ArenaChallengeCategory,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EngineeringArenaService {
  constructor(
    private readonly challengeRepo: ArenaChallengeRepository,
    private readonly sessionRepo: ArenaSessionRepository,
    private readonly workspaceRuntime: DeterministicLocalWorkspaceRuntime,
    private readonly evaluationService: ArenaEvaluationService,
    private readonly sseService: ArenaSseService,
  ) {}

  async listChallenges(filters?: { domain?: string; category?: string }) {
    const domainEnum = filters?.domain ? (filters.domain as ArenaChallengeDomain) : undefined;
    const categoryEnum = filters?.category
      ? (filters.category as ArenaChallengeCategory)
      : undefined;

    return this.challengeRepo.listPublishedChallenges({
      domain: domainEnum,
      category: categoryEnum,
    });
  }

  async getChallengeBySlug(slug: string) {
    const challenge = await this.challengeRepo.findBySlug(slug);
    if (!challenge) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Engineering challenge with slug '${slug}' was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }
    return challenge;
  }

  async startSession(userId: string, request: StartArenaSessionRequest) {
    const challenge = await this.getChallengeBySlug(request.challengeSlug);
    const activeVersion = challenge.versions[0];
    if (!activeVersion) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Challenge '${request.challengeSlug}' has no active version.`,
        HttpStatus.NOT_FOUND,
      );
    }

    const manifest = activeVersion.manifestJson as unknown as ArenaChallengeManifest;
    const workspaceHandle = `ws-${uuidv4()}`;

    // Provision runtime workspace
    const initialFiles: Record<string, string> = {};
    for (const visibleFile of manifest.visibleFiles || []) {
      initialFiles[visibleFile] = `// ${visibleFile} initial boilerplate\n`;
    }
    await this.workspaceRuntime.provision({
      sessionId: `pending-${workspaceHandle}`,
      workspaceHandle,
      manifest,
      files: initialFiles,
    });

    // Create session in CREATED state
    const session = await this.sessionRepo.createSession({
      userId,
      challengeVersionId: activeVersion.id,
      workspaceHandle,
      aiAssistanceMode: request.aiAssistanceMode as any,
      expiresAt: new Date(Date.now() + (manifest.estimatedMinutes + 30) * 60 * 1000),
    });

    // Validate state transition from CREATED -> PROVISIONING -> READY
    ArenaSessionStateMachine.validateTransition(
      ArenaSessionState.CREATED,
      ArenaSessionState.PROVISIONING,
    );
    ArenaSessionStateMachine.validateTransition(
      ArenaSessionState.PROVISIONING,
      ArenaSessionState.READY,
    );

    await this.sessionRepo.updateSessionState(session.id, userId, ArenaSessionLifecycleState.READY);

    // Construct visible file tree
    const fileTree: ArenaFileNode[] = (manifest.visibleFiles || []).map(filePath => {
      const parts = filePath.split('/');
      const name = parts[parts.length - 1] ?? filePath;
      return {
        path: filePath,
        name,
        isDirectory: false,
        isEditable: (manifest.editableFiles || []).includes(filePath),
      };
    });

    return {
      id: session.id,
      userId: session.userId,
      challengeSlug: challenge.slug,
      challengeTitle: challenge.title,
      challengeDomain: challenge.domain,
      challengeCategory: challenge.category,
      state: ArenaSessionState.READY,
      sandboxMode: session.sandboxMode,
      aiAssistanceMode: session.aiAssistanceMode,
      files: fileTree,
      initialFileContents: {},
      startedAt: session.startedAt.toISOString(),
      expiresAt: session.expiresAt?.toISOString(),
    };
  }

  async getSession(sessionId: string, userId: string) {
    const session = await this.sessionRepo.findSessionById(sessionId, userId);
    if (!session) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Arena session '${sessionId}' not found or access denied.`,
        HttpStatus.NOT_FOUND,
      );
    }
    return session;
  }

  getSessionSseStream(sessionId: string) {
    return this.sseService.getSessionStream(sessionId);
  }

  async runCommand(
    sessionId: string,
    userId: string,
    body: { commandId: string; modifiedFiles?: Array<{ path: string; content: string }> },
  ) {
    const session = await this.getSession(sessionId, userId);
    const manifest = session.challengeVersion.manifestJson as unknown as ArenaChallengeManifest;

    this.sseService.emitLog(sessionId, 'status', `Starting command '${body.commandId}'...`);

    // Transition from READY -> ACTIVE if first action
    if (session.state === ArenaSessionLifecycleState.READY) {
      ArenaSessionStateMachine.validateTransition(
        ArenaSessionState.READY,
        ArenaSessionState.ACTIVE,
      );
      await this.sessionRepo.updateSessionState(
        sessionId,
        userId,
        ArenaSessionLifecycleState.ACTIVE,
      );
    }

    const runResult = await this.workspaceRuntime.runAllowedCommand({
      workspaceHandle: session.workspaceHandle,
      commandId: body.commandId,
      manifest,
      modifiedFiles: body.modifiedFiles,
    });

    if (runResult.stdout) {
      this.sseService.emitLog(sessionId, 'stdout', runResult.stdout);
    }
    if (runResult.stderr) {
      this.sseService.emitLog(sessionId, 'stderr', runResult.stderr);
    }
    this.sseService.emitLog(
      sessionId,
      'status',
      `Execution finished with exit code ${runResult.exitCode} in ${runResult.durationMs}ms`,
    );

    const executionRun = await this.sessionRepo.createExecutionRun({
      sessionId,
      commandId: body.commandId,
      status: runResult.exitCode === 0 ? 'PASSED' : 'FAILED',
      exitCode: runResult.exitCode,
      stdout: runResult.stdout,
      stderr: runResult.stderr,
      durationMs: runResult.durationMs,
      testsTotal: runResult.testsTotal,
      testsPassed: runResult.testsPassed,
      testsFailed: runResult.testsFailed,
      testResults: runResult.testResults,
      workspaceSnapshotHash: runResult.snapshotHash,
    });

    return {
      id: executionRun.id,
      sessionId,
      commandId: executionRun.commandId,
      status: executionRun.status,
      exitCode: executionRun.exitCode,
      stdout: executionRun.stdout,
      stderr: executionRun.stderr,
      durationMs: executionRun.durationMs,
      testsTotal: executionRun.testsTotal,
      testsPassed: executionRun.testsPassed,
      testsFailed: executionRun.testsFailed,
      testResults: runResult.testResults,
      createdAt: executionRun.createdAt.toISOString(),
    };
  }

  async submitSolution(
    sessionId: string,
    userId: string,
    body: { explanation?: string; finalFiles: Array<{ path: string; content: string }> },
  ) {
    return this.evaluationService.submitAndEvaluate(sessionId, userId, body);
  }
}
