import { z } from 'zod';
import { XpSource } from '../enums/index';

export const XpTransactionDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number().int(),
  source: z.nativeEnum(XpSource),
  description: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type XpTransactionDto = z.infer<typeof XpTransactionDtoSchema>;

export const BadgeDtoSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  nameVi: z.string(),
  description: z.string(),
  descriptionVi: z.string(),
  iconUrl: z.string(),
  category: z.string(),
  xpReward: z.number().int(),
  isSecret: z.boolean(),
  isUnlocked: z.boolean(),
  unlockedAt: z.string().nullable().optional(),
});

export type BadgeDto = z.infer<typeof BadgeDtoSchema>;

export const GamificationProfileDtoSchema = z.object({
  userId: z.string().uuid(),
  totalXp: z.number().int(),
  currentLevel: z.number().int(),
  levelTitle: z.string(),
  levelTitleVi: z.string(),
  currentLevelMinXp: z.number().int(),
  nextLevelXp: z.number().int(),
  levelProgressPercent: z.number(),
  dailyXp: z.number().int(),
  dailyLoginClaimed: z.boolean(),
  streak: z.object({
    currentStreak: z.number().int(),
    longestStreak: z.number().int(),
    totalReviews: z.number().int(),
    freezeCount: z.number().int(),
    freezeUsedToday: z.boolean(),
  }),
  unlockedBadgesCount: z.number().int(),
  totalBadgesCount: z.number().int(),
  recentBadges: z.array(BadgeDtoSchema),
});

export type GamificationProfileDto = z.infer<typeof GamificationProfileDtoSchema>;

export const LevelUpEventDtoSchema = z.object({
  userId: z.string().uuid(),
  oldLevel: z.number().int(),
  newLevel: z.number().int(),
  totalXp: z.number().int(),
  levelTitle: z.string(),
  levelTitleVi: z.string(),
  xpReward: z.number().int().optional(),
});

export type LevelUpEventDto = z.infer<typeof LevelUpEventDtoSchema>;

export const LeaderboardEntryDtoSchema = z.object({
  rank: z.number().int(),
  userId: z.string().uuid(),
  displayName: z.string(),
  totalXp: z.number().int(),
  currentLevel: z.number().int(),
  levelTitle: z.string(),
  currentStreak: z.number().int(),
  isCurrentUser: z.boolean().optional(),
});

export type LeaderboardEntryDto = z.infer<typeof LeaderboardEntryDtoSchema>;

export const PushSubscriptionDtoSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  device: z.string().optional(),
});

export type PushSubscriptionDto = z.infer<typeof PushSubscriptionDtoSchema>;

export const NotificationPreferenceDtoSchema = z.object({
  dailyReminder: z.boolean(),
  streakWarning: z.boolean(),
  newFeatures: z.boolean(),
  reminderTime: z.string(),
});

export type NotificationPreferenceDto = z.infer<typeof NotificationPreferenceDtoSchema>;
