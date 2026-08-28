import { create } from 'zustand';
import { GamificationProfileDto, LevelUpEventDto, BadgeDto } from '@ai-interview/contracts';
import { apiClient } from '../lib/api-client';
import { sfx, playSFX } from '../lib/sfx-engine';
import { useAuthStore } from './auth.store';

export interface PendingXpItem {
  id: number;
  amount: number;
  reason: string;
}

const DEFAULT_BASELINE_PROFILE: GamificationProfileDto = {
  userId: '',
  totalXp: 0,
  currentLevel: 1,
  levelTitle: 'Novice Candidate',
  levelTitleVi: 'Ứng viên Tập sự',
  currentLevelMinXp: 0,
  nextLevelXp: 100,
  levelProgressPercent: 0,
  dailyXp: 0,
  dailyLoginClaimed: false,
  streak: {
    currentStreak: 0,
    longestStreak: 0,
    totalReviews: 0,
    freezeCount: 0,
    freezeUsedToday: false,
  },
  unlockedBadgesCount: 0,
  totalBadgesCount: 8,
  recentBadges: [],
};

const STORAGE_KEY = 'gamification_profile';

function loadSavedProfile(): GamificationProfileDto | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistProfile(profile: GamificationProfileDto | null) {
  if (typeof window === 'undefined' || !window.localStorage || !profile) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore quota errors
  }
}

const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

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

export const useGamificationStore = create<GamificationState>((set, get) => {
  const savedProfile = loadSavedProfile();

  return {
    profile: savedProfile || DEFAULT_BASELINE_PROFILE,
    isLoading: false,
    pendingXpDeltas: [],
    activeLevelUp: null,
    activeBadgeUnlock: null,
    sfxMuted: sfx.getIsMuted(),
    sfxVolume: sfx.getVolume(),

    fetchProfile: async () => {
      const authStore = useAuthStore.getState();
      if (!authStore.accessToken) {
        return;
      }
      set({ isLoading: true });
      try {
        const data = await apiClient<GamificationProfileDto>('/gamification/profile', {
          headers: { 'x-timezone': getUserTimezone() },
        });
        if (data && typeof data === 'object' && 'totalXp' in data) {
          persistProfile(data);
          set({ profile: data, isLoading: false });
        } else {
          set(state => ({ profile: state.profile || DEFAULT_BASELINE_PROFILE, isLoading: false }));
        }
      } catch {
        set(state => ({
          profile: state.profile || DEFAULT_BASELINE_PROFILE,
          isLoading: false,
        }));
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
        const currentProfile = state.profile || DEFAULT_BASELINE_PROFILE;
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

        const updatedProfile: GamificationProfileDto = {
          ...currentProfile,
          totalXp: newTotalXp,
          currentLevel: newLevel,
          currentLevelMinXp,
          nextLevelXp,
          levelProgressPercent: progressPercent,
          dailyXp: currentProfile.dailyXp + amount,
        };

        persistProfile(updatedProfile);

        return {
          profile: updatedProfile,
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
        }>('/gamification/claim-daily-login', {
          method: 'POST',
          headers: { 'x-timezone': getUserTimezone() },
        });

        if (res.claimed) {
          playSFX('success');
          persistProfile(res.profile);
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
          {
            method: 'POST',
            headers: { 'x-timezone': getUserTimezone() },
          },
        );
        if (res.success && get().profile) {
          playSFX('click');
          const updatedProfile: GamificationProfileDto = {
            ...get().profile!,
            streak: {
              ...get().profile!.streak,
              freezeCount: res.remainingFreezes,
              freezeUsedToday: true,
            },
          };
          persistProfile(updatedProfile);
          set({ profile: updatedProfile });
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
  };
});
