import { ArenaSessionStateMachine } from '../../src/modules/engineering-arena/state-machine/arena-session-state-machine';
import { DeterministicLocalWorkspaceRuntime } from '../../src/modules/engineering-arena/runtime/deterministic-local.runtime';
import { ArenaScoringEngine } from '../../src/modules/engineering-arena/scoring/arena-scoring-engine';
import { ChallengeValidatorService } from '../../src/modules/engineering-arena/validator/challenge-validator.service';
import { BENCHMARK_CHALLENGES } from '../../src/modules/engineering-arena/fixtures/benchmark-challenges';
import {
  ArenaSessionState,
  ArenaChallengeManifestSchema,
  ChallengeDomain,
  ChallengeCategory,
} from '@ai-interview/contracts';

describe('Comprehensive Platform & Engineering Arena 7-Tier Verification Suite', () => {
  let validator: ChallengeValidatorService;
  let runtime: DeterministicLocalWorkspaceRuntime;

  beforeEach(() => {
    validator = new ChallengeValidatorService();
    runtime = new DeterministicLocalWorkspaceRuntime();
  });

  describe('Tier 1: Type Safety & Contract Invariants', () => {
    it('validates that all 5 benchmark manifests strictly satisfy Zod schema contracts', () => {
      for (const challenge of BENCHMARK_CHALLENGES) {
        const parsed = ArenaChallengeManifestSchema.safeParse(challenge.manifest);
        expect(parsed.success).toBe(true);
      }
    });
  });

  describe('Tier 2: Domain State Machine Integrity', () => {
    it('proves valid lifecycle path: CREATED -> PROVISIONING -> READY -> ACTIVE -> SUBMITTING -> EVALUATING -> COMPLETED', () => {
      expect(
        ArenaSessionStateMachine.canTransition(
          ArenaSessionState.CREATED,
          ArenaSessionState.PROVISIONING,
        ),
      ).toBe(true);
      expect(
        ArenaSessionStateMachine.canTransition(
          ArenaSessionState.PROVISIONING,
          ArenaSessionState.READY,
        ),
      ).toBe(true);
      expect(
        ArenaSessionStateMachine.canTransition(ArenaSessionState.READY, ArenaSessionState.ACTIVE),
      ).toBe(true);
      expect(
        ArenaSessionStateMachine.canTransition(
          ArenaSessionState.ACTIVE,
          ArenaSessionState.SUBMITTING,
        ),
      ).toBe(true);
      expect(
        ArenaSessionStateMachine.canTransition(
          ArenaSessionState.SUBMITTING,
          ArenaSessionState.EVALUATING,
        ),
      ).toBe(true);
      expect(
        ArenaSessionStateMachine.canTransition(
          ArenaSessionState.EVALUATING,
          ArenaSessionState.COMPLETED,
        ),
      ).toBe(true);
    });

    it('proves terminal state immutability (No resurrection from COMPLETED, CANCELLED, EXPIRED)', () => {
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

  describe('Tier 3: Concurrency & Idempotency Invariants', () => {
    it('handles concurrent workspace file synchronization without race collisions', async () => {
      await runtime.provision({
        sessionId: 'session-concurrency',
        workspaceHandle: 'ws-concurrency',
        manifest: BENCHMARK_CHALLENGES[0]!.manifest,
        files: { 'src/index.ts': 'export const initial = 0;' },
      });

      const promises = [
        runtime.syncFiles('ws-concurrency', [{ path: 'src/file1.ts', content: 'content1' }]),
        runtime.syncFiles('ws-concurrency', [{ path: 'src/file2.ts', content: 'content2' }]),
        runtime.syncFiles('ws-concurrency', [{ path: 'src/file3.ts', content: 'content3' }]),
      ];

      await Promise.all(promises);

      const snapshot = await runtime.snapshot('ws-concurrency');
      expect(snapshot.files['src/file1.ts']).toBe('content1');
      expect(snapshot.files['src/file2.ts']).toBe('content2');
      expect(snapshot.files['src/file3.ts']).toBe('content3');
    });
  });

  describe('Tier 4: Security, Sandbox Isolation & Secret Containment', () => {
    it('rejects path traversal attempts across multiple attack patterns', async () => {
      const payloads = [
        '../etc/shadow',
        '..\\..\\windows\\system32',
        '/root/.bashrc',
        'subdir/../../../secret.txt',
      ];

      for (const payload of payloads) {
        await expect(
          runtime.provision({
            sessionId: 'sess-attack',
            workspaceHandle: `ws-attack-${Math.random()}`,
            manifest: BENCHMARK_CHALLENGES[0]!.manifest,
            files: { [payload]: 'evil' },
          }),
        ).rejects.toThrow('Path traversal');
      }
    });

    it('rejects commands outside of manifest allowlist', async () => {
      await runtime.provision({
        sessionId: 'sess-cmd',
        workspaceHandle: 'ws-cmd',
        manifest: BENCHMARK_CHALLENGES[0]!.manifest,
        files: { 'src/index.ts': 'test' },
      });

      await expect(
        runtime.runAllowedCommand({
          workspaceHandle: 'ws-cmd',
          commandId: 'rm -rf /',
          manifest: BENCHMARK_CHALLENGES[0]!.manifest,
        }),
      ).rejects.toThrow('not allowed');
    });
  });

  describe('Tier 5: Objective Scoring Fidelity & Score Caps', () => {
    it('enforces score cap = 40% when visible tests fail regardless of rubric score', () => {
      const score = ArenaScoringEngine.calculateScore({
        visibleTestsPassed: 1,
        visibleTestsTotal: 4,
        hiddenTestsPassed: 4,
        hiddenTestsTotal: 4,
        rubricScore: 100,
        manifest: BENCHMARK_CHALLENGES[0]!.manifest,
      });

      expect(score.scoreCapApplied).toBe(true);
      expect(score.finalScore).toBe(40);
      expect(score.scoreCapReason).toContain('Visible unit tests failed');
    });

    it('enforces score cap = 50% when zero hidden tests pass', () => {
      const score = ArenaScoringEngine.calculateScore({
        visibleTestsPassed: 4,
        visibleTestsTotal: 4,
        hiddenTestsPassed: 0,
        hiddenTestsTotal: 3,
        rubricScore: 90,
        manifest: BENCHMARK_CHALLENGES[0]!.manifest,
      });

      expect(score.scoreCapApplied).toBe(true);
      expect(score.finalScore).toBe(50);
      expect(score.scoreCapReason).toContain('Zero hidden verification tests');
    });
  });

  describe('Tier 6: Multi-Stage Package Validation', () => {
    it('passes 100% of the 6 validator stages for all 5 benchmark challenges', async () => {
      for (const challenge of BENCHMARK_CHALLENGES) {
        const report = await validator.validateChallengePackage({
          manifest: challenge.manifest,
          visibleFilesContent: challenge.visibleFiles,
          hiddenFilesContent: challenge.hiddenFiles,
          referenceSolutionContent: challenge.referenceSolution,
        });

        expect(report.overallPass).toBe(true);
        expect(report.failedStages).toBe(0);
        expect(report.passedStages).toBe(6);
      }
    });
  });

  describe('Tier 7: Benchmark Domain Coverage (F017)', () => {
    it('verifies presence of Security, Performance, Concurrency, and Distributed Queue challenges', () => {
      const categories = BENCHMARK_CHALLENGES.map(c => c.manifest.category);
      expect(categories).toContain(ChallengeCategory.SECURITY_REMEDIATION);
      expect(categories).toContain(ChallengeCategory.PERFORMANCE_OPTIMIZATION);
      expect(categories).toContain(ChallengeCategory.BUG_FIX);

      const domains = BENCHMARK_CHALLENGES.map(c => c.manifest.domain);
      expect(domains).toContain(ChallengeDomain.SECURITY);
      expect(domains).toContain(ChallengeDomain.BACKEND);
    });
  });
});
