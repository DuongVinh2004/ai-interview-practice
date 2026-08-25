import { describe, it, expect, beforeEach } from 'vitest';
import { useGamificationStore } from '../gamification.store';

describe('useGamificationStore', () => {
  beforeEach(() => {
    useGamificationStore.setState({
      profile: {
        userId: '11111111-1111-1111-1111-111111111111',
        totalXp: 50,
        currentLevel: 1,
        currentLevelMinXp: 0,
        nextLevelXp: 100,
        levelProgressPercent: 50,
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

    // Adding 30 XP (50 + 30 = 80 XP, still level 1)
    addXpLocally(30, 'Test XP');

    const state = useGamificationStore.getState();
    expect(state.profile?.totalXp).toBe(80);
    expect(state.profile?.currentLevel).toBe(1);
    expect(state.profile?.levelProgressPercent).toBe(80);
    expect(state.pendingXpDeltas.length).toBe(1);
    expect(state.pendingXpDeltas[0].amount).toBe(30);
  });

  it('should trigger level-up when crossing the 100 XP threshold', () => {
    const { addXpLocally } = useGamificationStore.getState();

    // Adding 60 XP (50 + 60 = 110 XP -> level 2)
    addXpLocally(60, 'Interview Complete');

    const state = useGamificationStore.getState();
    expect(state.profile?.totalXp).toBe(110);
    expect(state.profile?.currentLevel).toBe(2);
    expect(state.profile?.currentLevelMinXp).toBe(100);
    expect(state.profile?.nextLevelXp).toBe(400);
  });

  it('should toggle sound mute state', () => {
    const store = useGamificationStore.getState();
    expect(store.sfxMuted).toBe(false);

    store.toggleSfx();
    expect(useGamificationStore.getState().sfxMuted).toBe(true);

    store.toggleSfx();
    expect(useGamificationStore.getState().sfxMuted).toBe(false);
  });
});
