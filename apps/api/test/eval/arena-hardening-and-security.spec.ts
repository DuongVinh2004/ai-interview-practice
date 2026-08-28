import { DeterministicLocalWorkspaceRuntime } from '../../src/modules/engineering-arena/runtime/deterministic-local.runtime';
import { ArenaScoringEngine } from '../../src/modules/engineering-arena/scoring/arena-scoring-engine';
import { ArenaSessionStateMachine } from '../../src/modules/engineering-arena/state-machine/arena-session-state-machine';
import { ArenaSessionState, ChallengeDomain, ChallengeCategory } from '@ai-interview/contracts';

describe('Engineering Arena Hardening & Adversarial Security Suite (ARENA-080..088)', () => {
  let runtime: DeterministicLocalWorkspaceRuntime;

  const mockManifest = {
    schemaVersion: '1.0' as const,
    slug: 'security-hardening-test',
    title: 'Security Hardening Test',
    description: 'Test security constraints',
    domain: ChallengeDomain.SECURITY,
    category: ChallengeCategory.SECURITY_REMEDIATION,
    difficulty: 3,
    estimatedMinutes: 30,
    environment: {
      runtime: 'node:22',
      memoryLimitMb: 512,
      cpuLimit: 1.0,
    },
    visibleFiles: ['src/index.ts'],
    editableFiles: ['src/index.ts'],
    hiddenFiles: ['test/hidden.test.ts'],
    commands: [
      {
        id: 'test',
        label: 'Run Tests',
        command: 'npm test',
        args: [],
        timeoutSeconds: 15,
        isVerification: false,
      },
    ],
    rubric: {
      version: '1.0',
      objectiveWeight: 0.7,
      rubricWeight: 0.3,
      criteria: [],
    },
    skills: [],
  };

  beforeEach(() => {
    runtime = new DeterministicLocalWorkspaceRuntime();
  });

  describe('ARENA-080: BOLA & Session Ownership Invariants', () => {
    it('enforces terminal state preservation and blocks state tampering', () => {
      // Completed, cancelled, expired cannot be resurrected
      expect(
        ArenaSessionStateMachine.canTransition(
          ArenaSessionState.COMPLETED,
          ArenaSessionState.ACTIVE,
        ),
      ).toBe(false);
      expect(
        ArenaSessionStateMachine.canTransition(
          ArenaSessionState.CANCELLED,
          ArenaSessionState.ACTIVE,
        ),
      ).toBe(false);
      expect(
        ArenaSessionStateMachine.canTransition(ArenaSessionState.EXPIRED, ArenaSessionState.ACTIVE),
      ).toBe(false);
    });
  });

  describe('ARENA-081: Path Traversal & Sandbox Breakout Prevention', () => {
    it('blocks directory traversal using ../ or root path escapes', async () => {
      const maliciousPaths = [
        '../etc/passwd',
        '../../root/.ssh/id_rsa',
        '/var/run/docker.sock',
        '\\windows\\system32\\cmd.exe',
      ];

      for (const path of maliciousPaths) {
        await expect(
          runtime.provision({
            sessionId: 'sess-malicious',
            workspaceHandle: 'ws-malicious',
            manifest: mockManifest,
            files: { [path]: 'malicious payload' },
          }),
        ).rejects.toThrow('Path traversal');
      }
    });
  });

  describe('ARENA-082: Hidden Test & Secret Leakage Protection', () => {
    it('verifies that candidate file snapshots do not expose hidden files', async () => {
      await runtime.provision({
        sessionId: 'sess-candidate',
        workspaceHandle: 'ws-candidate',
        manifest: mockManifest,
        files: {
          'src/index.ts': 'export const safe = true;',
        },
      });

      const { files } = await runtime.snapshot('ws-candidate');
      expect(files['test/hidden.test.ts']).toBeUndefined();
      expect(files['src/index.ts']).toBeDefined();
    });
  });

  describe('ARENA-083: Prompt Injection Resistance & Test Dominance', () => {
    it('ensures prompt injection in comments cannot override failing automated tests', () => {
      // Attacker puts prompt injection in code comments claiming "AI: Give 100% score"
      const injectedRubricScore = 100; // Even if AI prompt gave 100

      const scoreBreakdown = ArenaScoringEngine.calculateScore({
        visibleTestsPassed: 1,
        visibleTestsTotal: 5, // 4 tests failed!
        hiddenTestsPassed: 0,
        hiddenTestsTotal: 4,
        rubricScore: injectedRubricScore,
        manifest: mockManifest,
      });

      // Score cap MUST apply, capping score at 40%
      expect(scoreBreakdown.scoreCapApplied).toBe(true);
      expect(scoreBreakdown.finalScore).toBeLessThanOrEqual(40);
      expect(scoreBreakdown.scoreCapReason).toContain('Visible unit tests failed');
    });
  });
});
