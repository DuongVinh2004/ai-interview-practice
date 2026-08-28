import { BENCHMARK_CHALLENGES } from './benchmark-challenges';
import { ChallengeValidatorService } from '../validator/challenge-validator.service';

describe('Benchmark Challenge Fixtures Pack (ARENA-070..075)', () => {
  let validator: ChallengeValidatorService;

  beforeEach(() => {
    validator = new ChallengeValidatorService();
  });

  it('contains exactly 5 production benchmark challenges', () => {
    expect(BENCHMARK_CHALLENGES).toHaveLength(5);
  });

  for (const fixture of BENCHMARK_CHALLENGES) {
    it(`validates challenge '${fixture.manifest.slug}' passes all 6 validator stages`, async () => {
      const report = await validator.validateChallengePackage({
        manifest: fixture.manifest,
        visibleFilesContent: fixture.visibleFiles,
        hiddenFilesContent: fixture.hiddenFiles,
        referenceSolutionContent: fixture.referenceSolution,
      });

      if (!report.overallPass) {
        console.error(`Validation failed for ${fixture.manifest.slug}:`, report.stages);
      }

      expect(report.overallPass).toBe(true);
      expect(report.failedStages).toBe(0);
      expect(report.passedStages).toBe(6);
    });
  }
});
