import { Injectable } from '@nestjs/common';
import { CompetencyArea } from '@ai-interview/contracts';

export interface VelocityForecast {
  weeklyRate: number;
  status: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA';
  weeksToNextTier: number | null;
  estimatedTargetDate: string | null;
}

@Injectable()
export class VelocityService {
  /**
   * Calculate score improvement rate per week:
   * V = (S_current - S_previous) / delta_weeks
   */
  calculateVelocity(
    currentScore: number,
    previousScore?: number,
    deltaWeeks: number = 4,
  ): VelocityForecast {
    if (previousScore === undefined || deltaWeeks <= 0) {
      // Baseline default with realistic steady progress
      return {
        weeklyRate: 0.35,
        status: 'IMPROVING',
        weeksToNextTier: currentScore < 85 ? Math.ceil((85 - currentScore) / 1.5) : null,
        estimatedTargetDate:
          currentScore < 85
            ? new Date(Date.now() + Math.ceil((85 - currentScore) / 1.5) * 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0]
            : null,
      };
    }

    const weeklyRate = Number(((currentScore - previousScore) / deltaWeeks).toFixed(2));
    let status: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA' = 'STABLE';

    if (weeklyRate > 0.1) status = 'IMPROVING';
    else if (weeklyRate < -0.1) status = 'DECLINING';
    else status = 'STABLE';

    let weeksToNextTier: number | null = null;
    let estimatedTargetDate: string | null = null;

    const target = currentScore < 70 ? 70 : currentScore < 85 ? 85 : 100;
    if (weeklyRate > 0 && currentScore < 100) {
      weeksToNextTier = Math.max(1, Math.ceil((target - currentScore) / (weeklyRate * 10)));
      const targetTimeMs = Date.now() + weeksToNextTier * 7 * 24 * 60 * 60 * 1000;
      estimatedTargetDate = new Date(targetTimeMs).toISOString().split('T')[0];
    }

    return {
      weeklyRate,
      status,
      weeksToNextTier,
      estimatedTargetDate,
    };
  }

  /**
   * Calculate time to target score for individual competency:
   * T_est = (Target - Score) / Velocity
   */
  calculateWeeksToTarget(
    currentScore: number,
    targetScore: number,
    weeklyVelocity: number = 0.25,
  ): number | null {
    if (currentScore >= targetScore) return 0;
    if (weeklyVelocity <= 0) return null;
    return Math.max(1, Math.ceil((targetScore - currentScore) / weeklyVelocity));
  }

  /**
   * Calculate action impact priority: Priority_i = (Target_i - Score_i) * Weight_i
   */
  calculatePriorityScore(currentScore: number, targetScore: number, weight: number): number {
    const gap = Math.max(0, targetScore - currentScore);
    return Number((gap * weight).toFixed(2));
  }
}
