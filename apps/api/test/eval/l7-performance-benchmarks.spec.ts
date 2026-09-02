import { MockAiProvider } from '../../src/modules/ai-orchestrator/providers/mock-ai.provider';
import { AiSecurityFilterService } from '../../src/modules/ai-orchestrator/security/ai-security-filter.service';
import { ArenaScoringEngine } from '../../src/modules/engineering-arena/scoring/arena-scoring-engine';
import { SandboxSecurityValidator } from '../../src/modules/code-execution/utils/sandbox-security.validator';
import { BENCHMARK_CHALLENGES } from '../../src/modules/engineering-arena/fixtures/benchmark-challenges';
import { ChallengeValidatorService } from '../../src/modules/engineering-arena/validator/challenge-validator.service';

describe('Tier 7: Performance Benchmarks & Latency SLA (PERF-001..008)', () => {
  let mockAi: MockAiProvider;
  let securityFilter: AiSecurityFilterService;
  let challengeValidator: ChallengeValidatorService;

  beforeEach(() => {
    mockAi = new MockAiProvider();
    securityFilter = new AiSecurityFilterService();
    challengeValidator = new ChallengeValidatorService();
  });

  function calculateP95(latencies: number[]): number {
    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[index] ?? 0;
  }

  it('PERF-01. Mock AI evaluateAnswer P95 latency <= 150ms over 50 iterations', async () => {
    const latencies: number[] = [];

    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      await mockAi.evaluateAnswer({
        role: 'Backend Engineer',
        level: 'Senior',
        question: 'Explain PostgreSQL MVCC.',
        answer: 'PostgreSQL uses multi-version concurrency control with transaction IDs.',
      });
      latencies.push(performance.now() - start);
    }

    const p95 = calculateP95(latencies);
    expect(p95).toBeLessThanOrEqual(150);
  });

  it('PERF-02. SecurityFilter.preFilter P95 latency <= 5ms over 100 iterations', () => {
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      securityFilter.preFilter({
        role: 'Backend Engineer',
        level: 'Senior',
        question: 'Explain caching.',
        answer: 'We use Redis cache-aside with distributed locks to avoid stampedes.',
      });
      latencies.push(performance.now() - start);
    }

    const p95 = calculateP95(latencies);
    expect(p95).toBeLessThanOrEqual(5);
  });

  it('PERF-03. ArenaScoringEngine.calculateScore P95 latency <= 1ms over 1000 iterations', () => {
    const latencies: number[] = [];
    const manifest = BENCHMARK_CHALLENGES[0]!.manifest;

    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      ArenaScoringEngine.calculateScore({
        visibleTestsPassed: 3,
        visibleTestsTotal: 4,
        hiddenTestsPassed: 2,
        hiddenTestsTotal: 2,
        rubricScore: 85,
        manifest,
      });
      latencies.push(performance.now() - start);
    }

    const p95 = calculateP95(latencies);
    expect(p95).toBeLessThanOrEqual(1);
  });

  it('PERF-04. SandboxSecurityValidator.validateCompilerOptions P95 latency <= 2ms over 500 iterations', () => {
    const latencies: number[] = [];

    for (let i = 0; i < 500; i++) {
      const start = performance.now();
      SandboxSecurityValidator.validateCompilerOptions('cpp', '-O2 -std=c++17 -Wall');
      latencies.push(performance.now() - start);
    }

    const p95 = calculateP95(latencies);
    expect(p95).toBeLessThanOrEqual(2);
  });

  it('PERF-05. Batch Concurrency: 50 parallel mock evaluations execute without deadlock in <= 500ms', async () => {
    const start = performance.now();

    const tasks = Array.from({ length: 50 }, (_, idx) =>
      mockAi.evaluateAnswer({
        role: 'Backend Engineer',
        level: 'Senior',
        question: `Question ${idx}`,
        answer: `Answer for ${idx} with idempotency key and atomic commit.`,
      }),
    );

    const results = await Promise.all(tasks);
    const duration = performance.now() - start;

    expect(results).toHaveLength(50);
    expect(duration).toBeLessThanOrEqual(500);
  });

  it('PERF-06. ChallengeValidatorService validateChallengePackage P95 latency <= 50ms', async () => {
    const latencies: number[] = [];
    const challenge = BENCHMARK_CHALLENGES[0]!;

    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      await challengeValidator.validateChallengePackage({
        manifest: challenge.manifest,
        visibleFilesContent: challenge.visibleFiles,
        hiddenFilesContent: challenge.hiddenFiles,
        referenceSolutionContent: challenge.referenceSolution,
      });
      latencies.push(performance.now() - start);
    }

    const p95 = calculateP95(latencies);
    expect(p95).toBeLessThanOrEqual(50);
  });
});
