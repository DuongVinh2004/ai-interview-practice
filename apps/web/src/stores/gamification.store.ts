import { create } from 'zustand';
import { GamificationProfileDto, LevelUpEventDto, BadgeDto } from '@ai-interview/contracts';
import { apiClient } from '../lib/api-client';
import { sfx, playSFX } from '../lib/sfx-engine';

export interface PendingXpItem {
  id: number;
  amount: number;
  reason: string;
}

interface GamificationState {
  profile: GamificationProfileDto | null;
  isLoading: boolean;
  pendingXpDeltas: PendingXpItem[];
  activeLevelUp: LevelUpEventDto | null;
  activeBadgeUnlock: BadgeDto | null;
  sfxMuted: boolean;
  sfxVolume: number;

  // Actions
  fetchProfile: () => Promise<void>;
  addXpLocally: (amount: number, reason: string) => void;
  removePendingXpDelta: (id: number) => void;
  claimDailyLogin: () => Promise<boolean>;
  useStreakFreeze: () => Promise<boolean>;
  showLevelUp: (event: LevelUpEventDto) => void;
  dismissLevelUp: () => void;
  showBadgeUnlock: (badge: BadgeDto) => void;
  dismissBadgeUnlock: () => void;
  toggleSfx: () => void;
  setSfxVolume: (vol: number) => void;
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
  profile: null,
  isLoading: false,
  pendingXpDeltas: [],
  activeLevelUp: null,
  activeBadgeUnlock: null,
  sfxMuted: sfx.getIsMuted(),
  sfxVolume: sfx.getVolume(),

  fetchProfile: async () => {
    set({ isLoading: true });
    try {
      const data = await apiClient<GamificationProfileDto>('/gamification/profile');
      set({ profile: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addXpLocally: (amount: number, reason: string) => {
    if (amount <= 0) return;

    playSFX('xp_coin');
    const deltaItem: PendingXpItem = {
      id: Date.now() + Math.random(),
      amount,
      reason,
    };

    set(state => {
      const currentProfile = state.profile;
      if (!currentProfile) {
        return {
          pendingXpDeltas: [...state.pendingXpDeltas, deltaItem],
        };
      }

      const newTotalXp = currentProfile.totalXp + amount;
      const newLevel = Math.floor(Math.sqrt(newTotalXp / 100)) + 1;
      const currentLevelMinXp = 100 * Math.pow(newLevel - 1, 2);
      const nextLevelXp = 100 * Math.pow(newLevel, 2);
      const progressPercent = Math.min(
        100,
        Math.round(((newTotalXp - currentLevelMinXp) / (nextLevelXp - currentLevelMinXp)) * 100),
      );

      const isLevelUp = newLevel > currentProfile.currentLevel;
      if (isLevelUp) {
        playSFX('level_up');
        setTimeout(() => {
          get().showLevelUp({
            userId: currentProfile.userId,
            oldLevel: currentProfile.currentLevel,
            newLevel,
            totalXp: newTotalXp,
            levelTitle: currentProfile.levelTitle,
            levelTitleVi: currentProfile.levelTitleVi,
          });
        }, 300);
      }

      return {
        profile: {
          ...currentProfile,
          totalXp: newTotalXp,
          currentLevel: newLevel,
          currentLevelMinXp,
          nextLevelXp,
          levelProgressPercent: progressPercent,
          dailyXp: currentProfile.dailyXp + amount,
        },
        pendingXpDeltas: [...state.pendingXpDeltas, deltaItem],
      };
    });
  },

  removePendingXpDelta: (id: number) => {
    set(state => ({
      pendingXpDeltas: state.pendingXpDeltas.filter(d => d.id !== id),
    }));
  },

  claimDailyLogin: async () => {
    try {
      const res = await apiClient<{
        claimed: boolean;
        xpAwarded: number;
        profile: GamificationProfileDto;
      }>('/gamification/claim-daily-login', { method: 'POST' });

      if (res.claimed) {
        playSFX('success');
        set({ profile: res.profile });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  useStreakFreeze: async () => {
    try {
      const res = await apiClient<{ success: boolean; remainingFreezes: number }>(
        '/gamification/use-freeze',
        { method: 'POST' },
      );
      if (res.success && get().profile) {
        playSFX('click');
        set(state => ({
          profile: state.profile
            ? {
                ...state.profile,
                streak: {
                  ...state.profile.streak,
                  freezeCount: res.remainingFreezes,
                  freezeUsedToday: true,
                },
              }
            : null,
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  showLevelUp: (event: LevelUpEventDto) => {
    set({ activeLevelUp: event });
  },

  dismissLevelUp: () => {
    set({ activeLevelUp: null });
  },

  showBadgeUnlock: (badge: BadgeDto) => {
    playSFX('success');
    set({ activeBadgeUnlock: badge });
  },

  dismissBadgeUnlock: () => {
    set({ activeBadgeUnlock: null });
  },

  toggleSfx: () => {
    const nextMute = !get().sfxMuted;
    sfx.setIsMuted(nextMute);
    set({ sfxMuted: nextMute });
  },

  setSfxVolume: (vol: number) => {
    sfx.setVolume(vol);
    set({ sfxVolume: vol });
  },
}));
