export class DifficultyCalculator {
  /**
   * Calculates next difficulty level based on answer score.
   * - Score >= 8: increase difficulty by +1
   * - Score <= 5: decrease difficulty by -1
   * - Otherwise: keep difficulty unchanged
   * Clamped to [1, 3]
   */
  static calculateNextDifficulty(currentDifficulty: number, score: number): number {
    let nextDifficulty = currentDifficulty;

    if (score >= 8) {
      nextDifficulty += 1;
    } else if (score <= 5) {
      nextDifficulty -= 1;
    }

    return Math.max(1, Math.min(3, nextDifficulty));
  }
}
