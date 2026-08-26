import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  XpSource,
  GamificationProfileDto,
  XpTransactionDto,
  LeaderboardEntryDto,
} from '@ai-interview/contracts';

export interface LevelInfo {
  level: number;
  levelTitle: string;
  levelTitleVi: string;
  currentLevelMinXp: number;
  nextLevelXp: number;
  progressPercent: number;
}

const LEVEL_TITLES = [
  { minLevel: 1, title: 'Novice Candidate', titleVi: 'Ứng viên Tập sự' },
  { minLevel: 2, title: 'Apprentice Engineer', titleVi: 'Kỹ sư Học việc' },
  { minLevel: 3, title: 'Junior Practitioner', titleVi: 'Lập trình viên Thực hành' },
  { minLevel: 4, title: 'Proficient Developer', titleVi: 'Kỹ sư Thành thạo' },
  { minLevel: 5, title: 'Senior Specialist', titleVi: 'Chuyên viên Cấp cao' },
  { minLevel: 6, title: 'Staff Architect', titleVi: 'Kiến trúc sư Trưởng' },
  { minLevel: 7, title: 'Principal Master', titleVi: 'Bậc thầy Công nghệ' },
  { minLevel: 8, title: 'Legendary Grandmaster', titleVi: 'Huyền thoại Thần thánh' },
];

@Injectable()
export class XpService {
  private readonly logger = new Logger(XpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Level Formula: Level = floor(sqrt(totalXp / 100)) + 1
   * Level 1: 0 - 99 XP
   * Level 2: 100 - 399 XP
   * Level 3: 400 - 899 XP
   * Level 4: 900 - 1599 XP
   * Level 5: 1600 - 2499 XP
   */
  calculateLevel(totalXp: number): LevelInfo {
    const safeXp = Math.max(0, totalXp);
    const level = Math.floor(Math.sqrt(safeXp / 100)) + 1;

    // Minimum XP for this current level: 100 * (level - 1)^2
    const currentLevelMinXp = 100 * Math.pow(level - 1, 2);
    // Minimum XP required to hit next level: 100 * level^2
    const nextLevelXp = 100 * Math.pow(level, 2);

    const xpInCurrentLevel = safeXp - currentLevelMinXp;
    const xpSpanForLevel = nextLevelXp - currentLevelMinXp;
    const progressPercent =
      xpSpanForLevel > 0
        ? Math.min(100, Math.round((xpInCurrentLevel / xpSpanForLevel) * 100))
        : 100;

    let levelTitle = LEVEL_TITLES[0].title;
    let levelTitleVi = LEVEL_TITLES[0].titleVi;

    for (const titleEntry of LEVEL_TITLES) {
      if (level >= titleEntry.minLevel) {
        levelTitle = titleEntry.title;
        levelTitleVi = titleEntry.titleVi;
      }
    }

    return {
      level,
      levelTitle,
      levelTitleVi,
      currentLevelMinXp,
      nextLevelXp,
      progressPercent,
    };
  }

  async awardXp(
    userId: string,
    amount: number,
    source: XpSource,
    description?: string,
  ): Promise<{
    userXp: any;
    transaction: any;
    isLevelUp: boolean;
    oldLevel: number;
    newLevel: number;
  }> {
    if (amount <= 0) {
      const userXp = await this.prisma.userXp.findUnique({ where: { userId } });
      return {
        userXp,
        transaction: null,
        isLevelUp: false,
        oldLevel: userXp?.currentLevel || 1,
        newLevel: userXp?.currentLevel || 1,
      };
    }

    const result = await this.prisma.$transaction(async tx => {
      // 1. Log transaction
      const transaction = await tx.xpTransaction.create({
        data: {
          userId,
          amount,
          source: source as any,
          description: description || null,
        },
      });

      // 2. Fetch existing user XP
      const existing = await tx.userXp.findUnique({ where: { userId } });
      const oldLevel = existing?.currentLevel || 1;
      const newTotalXp = (existing?.totalXp || 0) + amount;

      const levelInfo = this.calculateLevel(newTotalXp);
      const isLevelUp = levelInfo.level > oldLevel;

      const userXp = await tx.userXp.upsert({
        where: { userId },
        create: {
          userId,
          totalXp: amount,
          currentLevel: levelInfo.level,
          dailyXp: amount,
          lastEarnedAt: new Date(),
        },
        update: {
          totalXp: { increment: amount },
          currentLevel: levelInfo.level,
          dailyXp: { increment: amount },
          lastEarnedAt: new Date(),
        },
      });

      return {
        userXp,
        transaction,
        isLevelUp,
        oldLevel,
        newLevel: levelInfo.level,
        newTotalXp: userXp?.totalXp ?? newTotalXp,
        levelInfo,
      };
    });

    // 3. Emit events AFTER transaction successfully commits
    this.eventEmitter.emit('gamification.xp_awarded', {
      userId,
      amount,
      source,
      totalXp: result.newTotalXp,
      currentLevel: result.newLevel,
      isLevelUp: result.isLevelUp,
    });

    if (result.isLevelUp) {
      this.logger.log(
        `User ${userId} leveled up from ${result.oldLevel} to ${result.newLevel} (${result.levelInfo.levelTitle})!`,
      );
      this.eventEmitter.emit('gamification.level_up', {
        userId,
        oldLevel: result.oldLevel,
        newLevel: result.newLevel,
        totalXp: result.newTotalXp,
        levelTitle: result.levelInfo.levelTitle,
        levelTitleVi: result.levelInfo.levelTitleVi,
      });
    }

    return {
      userXp: result.userXp,
      transaction: result.transaction,
      isLevelUp: result.isLevelUp,
      oldLevel: result.oldLevel,
      newLevel: result.newLevel,
    };
  }

  async claimDailyLogin(userId: string): Promise<{
    claimed: boolean;
    xpAwarded: number;
    profile: GamificationProfileDto;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingDailyClaim = await this.prisma.xpTransaction.findFirst({
      where: {
        userId,
        source: XpSource.DAILY_LOGIN as any,
        createdAt: { gte: today },
      },
    });

    if (existingDailyClaim) {
      const profile = await this.getGamificationProfile(userId);
      return { claimed: false, xpAwarded: 0, profile };
    }

    await this.awardXp(
      userId,
      10,
      XpSource.DAILY_LOGIN,
      'Điểm danh hàng ngày / Daily Login Streak',
    );

    const profile = await this.getGamificationProfile(userId);
    return { claimed: true, xpAwarded: 10, profile };
  }

  async getGamificationProfile(userId: string): Promise<GamificationProfileDto> {
    const userXp = await this.prisma.userXp.findUnique({
      where: { userId },
    });

    const userStreak = await this.prisma.userStreak.findUnique({
      where: { userId },
    });

    const totalXp = userXp?.totalXp || 0;
    const levelInfo = this.calculateLevel(totalXp);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyLoginClaim = await this.prisma.xpTransaction.findFirst({
      where: {
        userId,
        source: XpSource.DAILY_LOGIN as any,
        createdAt: { gte: today },
      },
    });

    const allBadges = await this.prisma.badgeDefinition.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        unlocks: {
          where: { userId },
        },
      },
    });

    const recentBadges = allBadges
      .filter(b => b.unlocks.length > 0)
      .slice(0, 4)
      .map(b => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        nameVi: b.nameVi,
        description: b.description,
        descriptionVi: b.descriptionVi,
        iconUrl: b.iconUrl,
        category: b.category,
        xpReward: b.xpReward,
        isSecret: b.isSecret,
        isUnlocked: true,
        unlockedAt: b.unlocks[0]?.unlockedAt ? b.unlocks[0].unlockedAt.toISOString() : null,
      }));

    const unlockedBadgesCount = allBadges.filter(b => b.unlocks.length > 0).length;

    return {
      userId,
      totalXp,
      currentLevel: levelInfo.level,
      levelTitle: levelInfo.levelTitle,
      levelTitleVi: levelInfo.levelTitleVi,
      currentLevelMinXp: levelInfo.currentLevelMinXp,
      nextLevelXp: levelInfo.nextLevelXp,
      levelProgressPercent: levelInfo.progressPercent,
      dailyXp: userXp?.dailyXp || 0,
      dailyLoginClaimed: !!dailyLoginClaim,
      streak: {
        currentStreak: userStreak?.currentStreak || 0,
        longestStreak: userStreak?.longestStreak || 0,
        totalReviews: userStreak?.totalReviews || 0,
        freezeCount: userStreak?.streakFreezeCount || 0,
        freezeUsedToday: userStreak?.streakFreezeUsedToday || false,
      },
      unlockedBadgesCount,
      totalBadgesCount: allBadges.length,
      recentBadges,
    };
  }

  async getHistory(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ total: number; transactions: XpTransactionDto[] }> {
    const [total, txs] = await Promise.all([
      this.prisma.xpTransaction.count({ where: { userId } }),
      this.prisma.xpTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      total,
      transactions: txs.map(t => ({
        id: t.id,
        userId: t.userId,
        amount: t.amount,
        source: t.source as XpSource,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  async getLeaderboard(limit = 10, currentUserId?: string): Promise<LeaderboardEntryDto[]> {
    const topUsers = await this.prisma.userXp.findMany({
      orderBy: { totalXp: 'desc' },
      take: limit,
      include: {
        user: {
          include: {
            profile: true,
            userStreak: true,
          },
        },
      },
    });

    return topUsers.map((ux, idx) => {
      const levelInfo = this.calculateLevel(ux.totalXp);
      return {
        rank: idx + 1,
        userId: ux.userId,
        displayName: ux.user.profile?.fullName || ux.user.email.split('@')[0],
        totalXp: ux.totalXp,
        currentLevel: levelInfo.level,
        levelTitle: levelInfo.levelTitle,
        currentStreak: ux.user.userStreak?.currentStreak || 0,
        isCurrentUser: currentUserId ? ux.userId === currentUserId : false,
      };
    });
  }
}
