import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGamificationStore } from '../gamification.store';

describe('useGamificationStore', () => {
  beforeEach(() => {
    useGamificationStore.setState({
      profile: {
        userId: '11111111-1111-1111-1111-111111111111',
        totalXp: 50,
        currentLevel: 1,
        currentLevelMinXp: 0,
        nextLevelXp: 282,
        levelProgressPercent: 18,
        levelTitle: 'Junior Developer',
        levelTitleVi: 'Lập trình viên Sơ cấp',
        dailyXp: 50,
        streak: {
          currentStreak: 3,
          longestStreak: 5,
          totalReviews: 10,
          freezeCount: 1,
          freezeUsedToday: false,
        },
        dailyLoginClaimed: false,
        unlockedBadgesCount: 2,
        totalBadgesCount: 8,
        recentBadges: [],
      },
      pendingXpDeltas: [],
      activeLevelUp: null,
      activeBadgeUnlock: null,
      sfxMuted: false,
      sfxVolume: 0.5,
    });
  });

  it('should add XP locally and update level progress correctly', () => {
    const { addXpLocally } = useGamificationStore.getState();

    // Adding 91 XP (50 + 91 = 141 XP, still level 1, 141/282 = 50%)
    addXpLocally(91, 'Test XP');

    const state = useGamificationStore.getState();
    expect(state.profile?.totalXp).toBe(141);
    expect(state.profile?.currentLevel).toBe(1);
    expect(state.profile?.levelProgressPercent).toBe(50);
    expect(state.pendingXpDeltas.length).toBe(1);
    expect(state.pendingXpDeltas[0].amount).toBe(91);
  });

  it('should trigger level-up when crossing the 282 XP threshold based on 100 * Level^1.5', () => {
    const { addXpLocally } = useGamificationStore.getState();

    // Adding 250 XP (50 + 250 = 300 XP -> level 2)
    addXpLocally(250, 'Interview Complete');

    const state = useGamificationStore.getState();
    expect(state.profile?.totalXp).toBe(300);
    expect(state.profile?.currentLevel).toBe(2);
    expect(state.profile?.currentLevelMinXp).toBe(282);
    expect(state.profile?.nextLevelXp).toBe(519);
  });

  it('should toggle sound mute state', () => {
    const store = useGamificationStore.getState();
    expect(store.sfxMuted).toBe(false);

    store.toggleSfx();
    expect(useGamificationStore.getState().sfxMuted).toBe(true);

    store.toggleSfx();
    expect(useGamificationStore.getState().sfxMuted).toBe(false);
  });

  it('should claim daily login and update profile state', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes('/gamification/claim-daily-login')) {
        expect(opts.headers['x-timezone']).toBeDefined();
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  claimed: true,
                  xpAwarded: 10,
                  profile: {
                    ...useGamificationStore.getState().profile,
                    dailyLoginClaimed: true,
                    totalXp: 60,
                  },
                },
              }),
            ),
        });
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    });

    const success = await useGamificationStore.getState().claimDailyLogin();
    expect(success).toBe(true);
    expect(useGamificationStore.getState().profile?.dailyLoginClaimed).toBe(true);
  });

  it('should use streak freeze and update freeze count in profile', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes('/gamification/use-freeze')) {
        expect(opts.headers['x-timezone']).toBeDefined();
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  success: true,
                  remainingFreezes: 0,
                },
              }),
            ),
        });
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    });

    const success = await useGamificationStore.getState().useStreakFreeze();
    expect(success).toBe(true);
    expect(useGamificationStore.getState().profile?.streak.freezeCount).toBe(0);
    expect(useGamificationStore.getState().profile?.streak.freezeUsedToday).toBe(true);
  });
});
