import { DifficultyCalculator } from './difficulty.calculator';

describe('DifficultyCalculator', () => {
  it('increases difficulty when score >= 8 and clamps at 3', () => {
    expect(DifficultyCalculator.calculateNextDifficulty(1, 8.0)).toBe(2);
    expect(DifficultyCalculator.calculateNextDifficulty(2, 9.5)).toBe(3);
    expect(DifficultyCalculator.calculateNextDifficulty(3, 10.0)).toBe(3); // clamped at 3
  });

  it('decreases difficulty when score <= 5 and clamps at 1', () => {
    expect(DifficultyCalculator.calculateNextDifficulty(3, 5.0)).toBe(2);
    expect(DifficultyCalculator.calculateNextDifficulty(2, 4.0)).toBe(1);
    expect(DifficultyCalculator.calculateNextDifficulty(1, 2.0)).toBe(1); // clamped at 1
  });

  it('leaves difficulty unchanged for mid-range scores (5 < score < 8)', () => {
    expect(DifficultyCalculator.calculateNextDifficulty(1, 6.0)).toBe(1);
    expect(DifficultyCalculator.calculateNextDifficulty(2, 7.5)).toBe(2);
    expect(DifficultyCalculator.calculateNextDifficulty(3, 6.8)).toBe(3);
  });
});
