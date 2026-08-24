import { CardState, FSRSRating } from '@ai-interview/contracts';

export interface FSRSCard {
  due: Date;
  stability: number; // S: memory stability in days
  difficulty: number; // D: intrinsic difficulty (1-10)
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview: Date | null;
}

export interface FSRSReviewLog {
  rating: FSRSRating;
  state: CardState; // State before review
  due: Date; // Scheduled due after review
  stability: number;
  difficulty: number;
  elapsedDays: number;
  lastElapsed: number;
  scheduledDays: number;
  reviewedAt: Date;
  durationMs: number;
}

export interface FSRSResult {
  card: FSRSCard;
  log: FSRSReviewLog;
}

// Standard FSRS v4 default parameter weights
const DEFAULT_WEIGHTS = [
  0.4, 0.6, 2.4, 5.8, // w0..w3: Initial stability for ratings Again, Hard, Good, Easy
  4.93, 0.94, 0.86, 0.01, // w4..w7: Difficulty parameters
  1.49, 0.14, 0.94, // w8..w10: Stability on success
  2.18, 0.05, 0.34, 1.26, // w11..w14: Stability on lapse
  0.29, 2.61, // w15..w16: Hard & Easy bonuses
];

const DECAY = -0.5;
const FACTOR = 19 / 81;

export class FSRSEngine {
  private readonly w: number[];
  private readonly requestRetention: number;

  constructor(weights: number[] = DEFAULT_WEIGHTS, requestRetention: number = 0.9) {
    this.w = weights;
    this.requestRetention = requestRetention;
  }

  /**
   * Initializes a brand new card
   */
  createEmptyCard(now: Date = new Date()): FSRSCard {
    return {
      due: now,
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: CardState.NEW,
      lastReview: null,
    };
  }

  /**
   * Computes retrievability (recall probability) at a given point in time
   */
  getRetrievability(card: FSRSCard, now: Date = new Date()): number {
    if (card.state === CardState.NEW || card.stability <= 0 || !card.lastReview) {
      return 0;
    }
    const elapsedDays = Math.max(0, (now.getTime() - card.lastReview.getTime()) / (1000 * 60 * 60 * 24));
    return Math.pow(1 + (FACTOR * elapsedDays) / card.stability, DECAY);
  }

  /**
   * Schedules a card after a review with the given rating (1: Again, 2: Hard, 3: Good, 4: Easy)
   */
  scheduleCard(card: FSRSCard, rating: FSRSRating, durationMs: number = 0, now: Date = new Date()): FSRSResult {
    const currentState = card.state;
    let nextStability: number;
    let nextDifficulty: number;
    let nextState: CardState;
    let elapsedDays = 0;

    if (card.lastReview) {
      elapsedDays = Math.max(0, Math.floor((now.getTime() - card.lastReview.getTime()) / (1000 * 60 * 60 * 24)));
    }

    if (currentState === CardState.NEW) {
      // First review
      nextDifficulty = this.initDifficulty(rating);
      nextStability = this.initStability(rating);

      if (rating === FSRSRating.AGAIN) {
        nextState = CardState.LEARNING;
      } else if (rating === FSRSRating.HARD) {
        nextState = CardState.LEARNING;
      } else {
        nextState = CardState.REVIEW;
      }
    } else {
      // Existing review
      const retrievability = this.getRetrievability(card, now);
      nextDifficulty = this.updateDifficulty(card.difficulty, rating);

      if (rating === FSRSRating.AGAIN) {
        nextStability = this.updateStabilityOnLapse(card.difficulty, card.stability, retrievability);
        nextState = CardState.RELEARNING;
      } else {
        nextStability = this.updateStabilityOnSuccess(card.difficulty, card.stability, retrievability, rating);
        nextState = CardState.REVIEW;
      }
    }

    // Compute interval in days
    const interval = this.computeInterval(nextStability);
    const nextDue = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

    const updatedCard: FSRSCard = {
      due: nextDue,
      stability: Number(nextStability.toFixed(4)),
      difficulty: Number(nextDifficulty.toFixed(4)),
      elapsedDays,
      scheduledDays: interval,
      reps: rating === FSRSRating.AGAIN ? card.reps : card.reps + 1,
      lapses: rating === FSRSRating.AGAIN ? card.lapses + 1 : card.lapses,
      state: nextState,
      lastReview: now,
    };

    const reviewLog: FSRSReviewLog = {
      rating,
      state: currentState,
      due: nextDue,
      stability: updatedCard.stability,
      difficulty: updatedCard.difficulty,
      elapsedDays,
      lastElapsed: card.elapsedDays,
      scheduledDays: interval,
      reviewedAt: now,
      durationMs,
    };

    return { card: updatedCard, log: reviewLog };
  }

  private initStability(rating: FSRSRating): number {
    return Math.max(0.1, this.w[rating - 1]);
  }

  private initDifficulty(rating: FSRSRating): number {
    const d = this.w[4] - Math.exp(this.w[5] * (rating - 1)) + 1;
    return this.clamp(d, 1, 10);
  }

  private updateDifficulty(d: number, rating: FSRSRating): number {
    const d0_4 = this.initDifficulty(FSRSRating.EASY);
    const nextD = this.w[7] * d0_4 + (1 - this.w[7]) * (d - this.w[6] * (rating - 3));
    return this.clamp(nextD, 1, 10);
  }

  private updateStabilityOnSuccess(d: number, s: number, r: number, rating: FSRSRating): number {
    let hardPenalty = 1;
    if (rating === FSRSRating.HARD) {
      hardPenalty = this.w[15];
    } else if (rating === FSRSRating.EASY) {
      hardPenalty = this.w[16];
    }
    const factor = Math.exp(this.w[8]) * (11 - d) * Math.pow(s, -this.w[9]) * (Math.exp((1 - r) * this.w[10]) - 1) * hardPenalty;
    return Math.max(0.1, s * (1 + factor));
  }

  private updateStabilityOnLapse(d: number, s: number, r: number): number {
    const factor = this.w[11] * Math.pow(d, -this.w[12]) * (Math.pow(s + 1, this.w[13]) - 1) * Math.exp((1 - r) * this.w[14]);
    return Math.min(Math.max(0.1, factor), s);
  }

  private computeInterval(stability: number): number {
    const newInterval = (stability / FACTOR) * (Math.pow(this.requestRetention, 1 / DECAY) - 1);
    return Math.min(365, Math.max(1, Math.round(newInterval)));
  }

  private clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }
}
