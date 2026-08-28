import { ArenaScoreBreakdown, ArenaChallengeManifest } from '@ai-interview/contracts';

export interface ObjectiveEvaluationInput {
  visibleTestsPassed: number;
  visibleTestsTotal: number;
  hiddenTestsPassed: number;
  hiddenTestsTotal: number;
  rubricScore?: number; // 0..100
  manifest: ArenaChallengeManifest;
}

export class ArenaScoringEngine {
  /**
   * Pure deterministic scoring calculation according to manifest weights and score caps.
   */
  static calculateScore(input: ObjectiveEvaluationInput): ArenaScoreBreakdown {
    const totalTests = input.visibleTestsTotal + input.hiddenTestsTotal;
    const totalPassed = input.visibleTestsPassed + input.hiddenTestsPassed;

    // 1. Calculate raw objective score (0..100)
    let objectiveScore = 0;
    if (totalTests > 0) {
      objectiveScore = Math.round((totalPassed / totalTests) * 100);
    }

    const rubricScore =
      input.rubricScore !== undefined ? Math.max(0, Math.min(100, input.rubricScore)) : 100;

    const objWeight = input.manifest.rubric.objectiveWeight ?? 0.7;
    const rubWeight = input.manifest.rubric.rubricWeight ?? 0.3;

    let weightedScore = Math.round(objectiveScore * objWeight + rubricScore * rubWeight);

    // 2. Score Cap Enforcement
    // Rule: If visible tests fail or any critical verification fails, final score is capped at 40
    let scoreCapApplied = false;
    let scoreCapReason: string | null = null;

    if (input.visibleTestsTotal > 0 && input.visibleTestsPassed < input.visibleTestsTotal) {
      scoreCapApplied = true;
      scoreCapReason = 'Visible unit tests failed. Score is capped at 40%.';
      weightedScore = Math.min(weightedScore, 40);
    } else if (input.hiddenTestsTotal > 0 && input.hiddenTestsPassed === 0) {
      scoreCapApplied = true;
      scoreCapReason = 'Zero hidden verification tests passed. Score is capped at 50%.';
      weightedScore = Math.min(weightedScore, 50);
    }

    return {
      objectiveScore,
      rubricScore,
      finalScore: weightedScore,
      scoreCapApplied,
      scoreCapReason,
      testsVisiblePassed: input.visibleTestsPassed,
      testsVisibleTotal: input.visibleTestsTotal,
      testsHiddenPassed: input.hiddenTestsPassed,
      testsHiddenTotal: input.hiddenTestsTotal,
    };
  }
}
