import { ArenaScoringEngine } from './arena-scoring-engine';
import { ChallengeDomain, ChallengeCategory } from '@ai-interview/contracts';

describe('ArenaScoringEngine', () => {
  const mockManifest = {
    schemaVersion: '1.0' as const,
    slug: 'fix-memory-leak',
    title: 'Fix Memory Leak',
    description: 'Fix leak in cache',
    domain: ChallengeDomain.BACKEND,
    category: ChallengeCategory.BUG_FIX,
    difficulty: 3,
    estimatedMinutes: 30,
    environment: {
      runtime: 'node:22',
      memoryLimitMb: 512,
      cpuLimit: 1.0,
    },
    visibleFiles: ['src/cache.ts'],
    editableFiles: ['src/cache.ts'],
    hiddenFiles: ['test/hidden.test.ts'],
    commands: [
      {
        id: 'test',
        label: 'Run',
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

  it('calculates full score when all tests pass with high rubric score', () => {
    const result = ArenaScoringEngine.calculateScore({
      visibleTestsPassed: 5,
      visibleTestsTotal: 5,
      hiddenTestsPassed: 5,
      hiddenTestsTotal: 5,
      rubricScore: 90,
      manifest: mockManifest,
    });

    expect(result.objectiveScore).toBe(100);
    expect(result.rubricScore).toBe(90);
    expect(result.finalScore).toBe(97); // 100 * 0.7 + 90 * 0.3 = 70 + 27 = 97
    expect(result.scoreCapApplied).toBe(false);
    expect(result.scoreCapReason).toBeNull();
  });

  it('applies score cap at 40% when visible tests fail', () => {
    const result = ArenaScoringEngine.calculateScore({
      visibleTestsPassed: 2,
      visibleTestsTotal: 5, // Failed 3 visible tests!
      hiddenTestsPassed: 5,
      hiddenTestsTotal: 5,
      rubricScore: 100,
      manifest: mockManifest,
    });

    expect(result.scoreCapApplied).toBe(true);
    expect(result.finalScore).toBe(40);
    expect(result.scoreCapReason).toContain('Visible unit tests failed');
  });

  it('applies score cap at 50% when zero hidden verification tests pass', () => {
    const result = ArenaScoringEngine.calculateScore({
      visibleTestsPassed: 5,
      visibleTestsTotal: 5,
      hiddenTestsPassed: 0,
      hiddenTestsTotal: 4, // 0 hidden passed!
      rubricScore: 100,
      manifest: mockManifest,
    });

    expect(result.scoreCapApplied).toBe(true);
    expect(result.finalScore).toBe(50);
    expect(result.scoreCapReason).toContain('Zero hidden verification tests');
  });
});
