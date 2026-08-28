import { describe, it, expect } from 'vitest';
import { getNextUpgradePlan, PLAN_TIERS } from '../lib/plan-tier.utils';

describe('Plan Tier Hierarchy & Next Upgrade Plan Suggestion', () => {
  it('correctly orders tier ranks', () => {
    expect(PLAN_TIERS.free.rank).toBeLessThan(PLAN_TIERS.pro.rank);
    expect(PLAN_TIERS.pro.rank).toBeLessThan(PLAN_TIERS.team.rank);
    expect(PLAN_TIERS.team.rank).toBeLessThan(PLAN_TIERS.enterprise.rank);
  });

  it('suggests PRO plan when user is on FREE tier', () => {
    const suggestion = getNextUpgradePlan('free', false, true);
    expect(suggestion.hasHigherPlan).toBe(true);
    expect(suggestion.targetPlanSlug).toBe('pro');
    expect(suggestion.buttonLabel).toContain('Pro');
    expect(suggestion.ctaText).toContain('Pro');
  });

  it('suggests TEAM plan when user is on PRO tier', () => {
    const suggestion = getNextUpgradePlan('pro', false, true);
    expect(suggestion.hasHigherPlan).toBe(true);
    expect(suggestion.targetPlanSlug).toBe('team');
    expect(suggestion.buttonLabel).toContain('Team');
    expect(suggestion.ctaText).toContain('Team');
  });

  it('suggests ENTERPRISE plan when user is on TEAM / B2B tier', () => {
    const suggestionTeam = getNextUpgradePlan('team', false, true);
    expect(suggestionTeam.hasHigherPlan).toBe(true);
    expect(suggestionTeam.targetPlanSlug).toBe('enterprise');
    expect(suggestionTeam.buttonLabel).toContain('Enterprise');

    const suggestionB2b = getNextUpgradePlan('b2b', false, true);
    expect(suggestionB2b.hasHigherPlan).toBe(true);
    expect(suggestionB2b.targetPlanSlug).toBe('enterprise');
  });

  it('hides all upgrade actions when user is on highest tier (ENTERPRISE)', () => {
    const suggestion = getNextUpgradePlan('enterprise', false, true);
    expect(suggestion.hasHigherPlan).toBe(false);
    expect(suggestion.targetPlanSlug).toBe('');
    expect(suggestion.buttonLabel).toBe('');
    expect(suggestion.boxBadge).toBe('VIP');
  });

  it('hides all upgrade actions when user is an ADMIN', () => {
    const suggestion = getNextUpgradePlan('pro', true, true);
    expect(suggestion.hasHigherPlan).toBe(false);
    expect(suggestion.targetPlanSlug).toBe('');
    expect(suggestion.buttonLabel).toBe('');
    expect(suggestion.boxBadge).toBe('ADMIN');
  });
});
