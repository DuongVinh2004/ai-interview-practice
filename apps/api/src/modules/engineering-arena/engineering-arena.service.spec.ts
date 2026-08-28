import { Test, TestingModule } from '@nestjs/testing';
import { EngineeringArenaService } from './engineering-arena.service';
import { ArenaChallengeRepository } from './repositories/arena-challenge.repository';
import { ArenaSessionRepository } from './repositories/arena-session.repository';
import { DeterministicLocalWorkspaceRuntime } from './runtime/deterministic-local.runtime';
import { ArenaEvaluationService } from './services/arena-evaluation.service';
import { ArenaSseService } from './services/arena-sse.service';
import { ArenaAiAssistanceMode } from '@ai-interview/contracts';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { ArenaSessionLifecycleState } from '@prisma/client';

describe('EngineeringArenaService', () => {
  let service: EngineeringArenaService;
  let challengeRepo: {
    listPublishedChallenges: jest.Mock;
    findBySlug: jest.Mock;
  };
  let sessionRepo: {
    createSession: jest.Mock;
    findSessionById: jest.Mock;
    updateSessionState: jest.Mock;
    createExecutionRun: jest.Mock;
  };
  let workspaceRuntime: {
    provision: jest.Mock;
    runAllowedCommand: jest.Mock;
    snapshot: jest.Mock;
    syncFiles: jest.Mock;
  };
  let evaluationService: {
    submitAndEvaluate: jest.Mock;
  };

  const mockManifest = {
    schemaVersion: '1.0',
    slug: 'fix-memory-leak',
    title: 'Fix Memory Leak',
    domain: 'BACKEND',
    category: 'BUG_FIX',
    difficulty: 3,
    estimatedMinutes: 30,
    environment: { runtime: 'node:22' },
    visibleFiles: ['src/index.ts', 'src/cache.ts'],
    editableFiles: ['src/cache.ts'],
    hiddenFiles: ['test/hidden.test.ts'],
    commands: [{ id: 'test', label: 'Test', command: 'npm test', args: [] }],
    rubric: { version: '1.0', objectiveWeight: 0.7, rubricWeight: 0.3, criteria: [] },
    skills: [],
  };

  const mockChallenge = {
    id: 'c1111111-1111-1111-1111-111111111111',
    slug: 'fix-memory-leak',
    title: 'Fix Memory Leak',
    domain: 'BACKEND',
    category: 'BUG_FIX',
    difficulty: 3,
    status: 'PUBLISHED',
    versions: [
      {
        id: 'v1111111-1111-1111-1111-111111111111',
        versionNumber: 1,
        manifestJson: mockManifest,
      },
    ],
  };

  beforeEach(async () => {
    challengeRepo = {
      listPublishedChallenges: jest.fn().mockResolvedValue([mockChallenge]),
      findBySlug: jest.fn(),
    };

    sessionRepo = {
      createSession: jest.fn().mockResolvedValue({
        id: 's1111111-1111-1111-1111-111111111111',
        userId: 'u1111111-1111-1111-1111-111111111111',
        challengeVersionId: 'v1111111-1111-1111-1111-111111111111',
        state: ArenaSessionLifecycleState.CREATED,
        sandboxMode: 'STAGE_A_MOCK',
        aiAssistanceMode: 'HINTS_ONLY',
        startedAt: new Date('2026-08-28T12:00:00.000Z'),
        expiresAt: new Date('2026-08-28T13:00:00.000Z'),
      }),
      findSessionById: jest.fn(),
      updateSessionState: jest.fn().mockResolvedValue({ count: 1 }),
      createExecutionRun: jest.fn().mockResolvedValue({
        id: 'run-1',
        commandId: 'test',
        status: 'PASSED',
        exitCode: 0,
        stdout: 'All passed',
        stderr: '',
        durationMs: 50,
        testsTotal: 1,
        testsPassed: 1,
        testsFailed: 0,
        createdAt: new Date(),
      }),
    };

    workspaceRuntime = {
      provision: jest.fn().mockResolvedValue(undefined),
      runAllowedCommand: jest.fn().mockResolvedValue({
        commandId: 'test',
        exitCode: 0,
        stdout: 'All passed',
        stderr: '',
        durationMs: 50,
        testsTotal: 1,
        testsPassed: 1,
        testsFailed: 0,
        testResults: [],
        snapshotHash: 'hash-123',
      }),
      snapshot: jest.fn().mockResolvedValue({ snapshotHash: 'hash-123', files: {} }),
      syncFiles: jest.fn().mockResolvedValue(undefined),
    };

    evaluationService = {
      submitAndEvaluate: jest.fn().mockResolvedValue({
        id: 'eval-1',
        sessionId: 's1111111-1111-1111-1111-111111111111',
        submissionId: 'sub-1',
        scoreBreakdown: { finalScore: 90 },
      }),
    };

    const mockSseService = {
      emitLog: jest.fn(),
      getSessionStream: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EngineeringArenaService,
        { provide: ArenaChallengeRepository, useValue: challengeRepo },
        { provide: ArenaSessionRepository, useValue: sessionRepo },
        { provide: DeterministicLocalWorkspaceRuntime, useValue: workspaceRuntime },
        { provide: ArenaEvaluationService, useValue: evaluationService },
        { provide: ArenaSseService, useValue: mockSseService },
      ],
    }).compile();

    service = module.get<EngineeringArenaService>(EngineeringArenaService);
  });

  describe('listChallenges', () => {
    it('returns published challenges', async () => {
      const result = await service.listChallenges();
      expect(result).toEqual([mockChallenge]);
    });
  });

  describe('getChallengeBySlug', () => {
    it('returns challenge when found', async () => {
      challengeRepo.findBySlug.mockResolvedValue(mockChallenge);
      const result = await service.getChallengeBySlug('fix-memory-leak');
      expect(result).toEqual(mockChallenge);
    });

    it('throws RESOURCE_NOT_FOUND when not found', async () => {
      challengeRepo.findBySlug.mockResolvedValue(null);
      await expect(service.getChallengeBySlug('nonexistent')).rejects.toThrow(DomainException);
    });
  });

  describe('startSession', () => {
    it('creates session, provisions workspace and initializes file tree in READY state', async () => {
      challengeRepo.findBySlug.mockResolvedValue(mockChallenge);

      const response = await service.startSession('u1111111-1111-1111-1111-111111111111', {
        challengeSlug: 'fix-memory-leak',
        aiAssistanceMode: ArenaAiAssistanceMode.HINTS_ONLY,
      });

      expect(response.id).toBe('s1111111-1111-1111-1111-111111111111');
      expect(response.state).toBe('READY');
      expect(workspaceRuntime.provision).toHaveBeenCalled();
      expect(sessionRepo.updateSessionState).toHaveBeenCalledWith(
        's1111111-1111-1111-1111-111111111111',
        'u1111111-1111-1111-1111-111111111111',
        ArenaSessionLifecycleState.READY,
      );
    });
  });

  describe('runCommand', () => {
    it('runs allowed command in workspace and records execution run', async () => {
      sessionRepo.findSessionById.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        workspaceHandle: 'ws-1',
        state: ArenaSessionLifecycleState.READY,
        challengeVersion: { manifestJson: mockManifest },
      });

      const result = await service.runCommand('s1', 'u1', { commandId: 'test' });
      expect(result.id).toBe('run-1');
      expect(result.status).toBe('PASSED');
      expect(workspaceRuntime.runAllowedCommand).toHaveBeenCalled();
    });
  });

  describe('getSessionSseStream', () => {
    it('returns observable stream from sseService', () => {
      const stream = service.getSessionSseStream('s1');
      expect(stream).toBeDefined();
    });
  });

  describe('submitSolution', () => {
    it('delegates to evaluation service', async () => {
      const result = await service.submitSolution('s1', 'u1', {
        explanation: 'fixed',
        finalFiles: [],
      });
      expect(result.id).toBe('eval-1');
      expect(evaluationService.submitAndEvaluate).toHaveBeenCalledWith('s1', 'u1', {
        explanation: 'fixed',
        finalFiles: [],
      });
    });
  });
});
