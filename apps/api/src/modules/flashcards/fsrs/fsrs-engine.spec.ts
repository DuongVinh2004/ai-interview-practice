import { FSRSEngine } from './fsrs-engine';
import { CardState, FSRSRating } from '@ai-interview/contracts';

describe('FSRS v4 Engine (Spaced Repetition Algorithm)', () => {
  let engine: FSRSEngine;

  beforeEach(() => {
    engine = new FSRSEngine();
  });

  describe('New Card Scheduling', () => {
    it('initializes and schedules a new card rated AGAIN', () => {
      const now = new Date('2026-08-24T12:00:00Z');
      const card = engine.createEmptyCard(now);

      const result = engine.scheduleCard(card, FSRSRating.AGAIN, 5000, now);

      expect(result.card.state).toBe(CardState.LEARNING);
      expect(result.card.stability).toBe(0.4);
      expect(result.card.difficulty).toBeGreaterThan(0);
      expect(result.card.lapses).toBe(1);
      expect(result.card.reps).toBe(0);
      expect(result.card.scheduledDays).toBeGreaterThanOrEqual(1);
    });

    it('initializes and schedules a new card rated GOOD', () => {
      const now = new Date('2026-08-24T12:00:00Z');
      const card = engine.createEmptyCard(now);

      const result = engine.scheduleCard(card, FSRSRating.GOOD, 3000, now);

      expect(result.card.state).toBe(CardState.REVIEW);
      expect(result.card.stability).toBe(2.4);
      expect(result.card.reps).toBe(1);
      expect(result.card.lapses).toBe(0);
      expect(result.card.scheduledDays).toBeGreaterThan(1);
    });

    it('initializes and schedules a new card rated EASY with larger stability', () => {
      const now = new Date('2026-08-24T12:00:00Z');
      const card = engine.createEmptyCard(now);

      const result = engine.scheduleCard(card, FSRSRating.EASY, 2000, now);

      expect(result.card.state).toBe(CardState.REVIEW);
      expect(result.card.stability).toBe(5.8);
      expect(result.card.scheduledDays).toBeGreaterThan(5);
    });
  });

  describe('Review Progression and Retrievability Decay', () => {
    it('computes decay in retrievability over elapsed days', () => {
      const day0 = new Date('2026-08-24T12:00:00Z');
      const card = engine.createEmptyCard(day0);
      const res1 = engine.scheduleCard(card, FSRSRating.GOOD, 0, day0);

      // On day 0, R is 1.0
      const r0 = engine.getRetrievability(res1.card, day0);
      expect(r0).toBeCloseTo(1.0, 1);

      // On day 10, R decreases
      const day10 = new Date('2026-09-03T12:00:00Z');
      const r10 = engine.getRetrievability(res1.card, day10);
      expect(r10).toBeLessThan(r0);
      expect(r10).toBeGreaterThan(0);
    });

    it('transitions to RELEARNING state on lapse (AGAIN rating) after review', () => {
      const day0 = new Date('2026-08-24T12:00:00Z');
      const card = engine.createEmptyCard(day0);
      const res1 = engine.scheduleCard(card, FSRSRating.GOOD, 0, day0);

      const day5 = new Date('2026-08-29T12:00:00Z');
      const res2 = engine.scheduleCard(res1.card, FSRSRating.AGAIN, 0, day5);

      expect(res2.card.state).toBe(CardState.RELEARNING);
      expect(res2.card.lapses).toBe(1);
    });

    it('multiplies stability on consecutive successful reviews', () => {
      const day0 = new Date('2026-08-24T12:00:00Z');
      const card = engine.createEmptyCard(day0);
      const res1 = engine.scheduleCard(card, FSRSRating.GOOD, 0, day0);

      const day3 = new Date('2026-08-27T12:00:00Z');
      const res2 = engine.scheduleCard(res1.card, FSRSRating.GOOD, 0, day3);

      expect(res2.card.stability).toBeGreaterThan(res1.card.stability);
      expect(res2.card.scheduledDays).toBeGreaterThan(res1.card.scheduledDays);
    });
  });
});
