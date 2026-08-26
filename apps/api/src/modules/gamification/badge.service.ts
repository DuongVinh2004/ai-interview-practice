import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { XpService } from './xp.service';
import { XpSource, BadgeDto } from '@ai-interview/contracts';

export const SYSTEM_BADGES = [
  {
    slug: 'first-blood',
    name: 'First Blood',
    nameVi: 'Khởi Đầu Nan',
    description: 'Complete your very first mock technical interview session.',
    descriptionVi: 'Hoàn thành buổi phỏng vấn kỹ thuật thử nghiệm đầu tiên của bạn.',
    iconUrl: '🎯',
    category: 'INTERVIEW',
    xpReward: 50,
    isSecret: false,
    criteria: { metric: 'completed_interviews', op: 'gte', value: 1 },
  },
  {
    slug: 'perfect-ten',
    name: 'Perfectionist',
    nameVi: 'Điểm Tuyệt Đối',
    description: 'Score a perfect 10.0 on an interview answer evaluation.',
    descriptionVi: 'Đạt điểm số tuyệt đối 10.0 trong một câu trả lời phỏng vấn.',
    iconUrl: '🌟',
    category: 'INTERVIEW',
    xpReward: 100,
    isSecret: false,
    criteria: { metric: 'single_turn_score', op: 'gte', value: 10.0 },
  },
  {
    slug: 'streak-3',
    name: 'Consistency',
    nameVi: 'Kiên Trì 3 Ngày',
    description: 'Maintain a 3-day daily practice streak.',
    descriptionVi: 'Duy trì chuỗi học tập 3 ngày liên tiếp.',
    iconUrl: '🔥',
    category: 'STREAK',
    xpReward: 50,
    isSecret: false,
    criteria: { metric: 'current_streak', op: 'gte', value: 3 },
  },
  {
    slug: 'streak-7',
    name: '7-Day Scholar',
    nameVi: 'Học Giả 7 Ngày',
    description: 'Maintain an uninterrupted 7-day practice streak.',
    descriptionVi: 'Duy trì chuỗi học tập 7 ngày liên tiếp không ngắt quãng.',
    iconUrl: '⚡',
    category: 'STREAK',
    xpReward: 100,
    isSecret: false,
    criteria: { metric: 'current_streak', op: 'gte', value: 7 },
  },
  {
    slug: 'streak-30',
    name: 'Unstoppable',
    nameVi: 'Không Thể Cản Bước',
    description: 'Achieve a legendary 30-day practice streak.',
    descriptionVi: 'Đạt cột mốc chuỗi học tập 30 ngày huyền thoại.',
    iconUrl: '👑',
    category: 'STREAK',
    xpReward: 300,
    isSecret: false,
    criteria: { metric: 'current_streak', op: 'gte', value: 30 },
  },
  {
    slug: 'flashcard-100',
    name: 'Memory Master',
    nameVi: 'Bậc Thầy Ghi Nhớ',
    description: 'Review 100 flashcard active recall questions.',
    descriptionVi: 'Ôn tập 100 lượt câu hỏi thẻ nhớ Flashcard.',
    iconUrl: '🧠',
    category: 'LEARNING',
    xpReward: 50,
    isSecret: false,
    criteria: { metric: 'total_flashcard_reviews', op: 'gte', value: 100 },
  },
  {
    slug: 'polyglot-coder',
    name: 'Code Wizard',
    nameVi: 'Phù Thủy Mã Nguồn',
    description: 'Submit code that passes 100% of execution test cases.',
    descriptionVi: 'Nộp code giải thuật vượt qua 100% các ca kiểm thử trong Sandbox.',
    iconUrl: '💻',
    category: 'CODING',
    xpReward: 50,
    isSecret: false,
    criteria: { metric: 'code_all_tests_passed', op: 'eq', value: true },
  },
  {
    slug: 'night-owl',
    name: 'Night Owl',
    nameVi: 'Cú Đêm Luyện Tập',
    description: 'Practice an interview or flashcard session between 00:00 and 04:00.',
    descriptionVi: 'Luyện tập phỏng vấn hoặc flashcard trong khung giờ từ 00:00 đến 04:00.',
    iconUrl: '🦉',
    category: 'LEARNING',
    xpReward: 50,
    isSecret: true,
    criteria: { metric: 'hour_of_day', op: 'between', value: [0, 4] },
  },
];

@Injectable()
export class BadgeService implements OnModuleInit {
  private readonly logger = new Logger(BadgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly xpService: XpService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.seedBadgesIfMissing();
  }

  async seedBadgesIfMissing(): Promise<void> {
    try {
      for (const badge of SYSTEM_BADGES) {
        await this.prisma.badgeDefinition.upsert({
          where: { slug: badge.slug },
          create: {
            slug: badge.slug,
            name: badge.name,
            nameVi: badge.nameVi,
            description: badge.description,
            descriptionVi: badge.descriptionVi,
            iconUrl: badge.iconUrl,
            category: badge.category,
            xpReward: badge.xpReward,
            isSecret: badge.isSecret,
            criteria: badge.criteria,
          },
          update: {
            name: badge.name,
            nameVi: badge.nameVi,
            description: badge.description,
            descriptionVi: badge.descriptionVi,
            iconUrl: badge.iconUrl,
            category: badge.category,
            xpReward: badge.xpReward,
            isSecret: badge.isSecret,
            criteria: badge.criteria,
          },
        });
      }
      this.logger.log('Gamification badge definitions initialized successfully.');
    } catch (err: any) {
      this.logger.warn(`Failed to seed badge definitions: ${err.message}`);
    }
  }

  async getAllBadges(userId?: string): Promise<BadgeDto[]> {
    const definitions = await this.prisma.badgeDefinition.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        unlocks: userId
          ? {
              where: { userId },
            }
          : false,
      },
    });

    return definitions.map(b => {
      const isUnlocked = b.unlocks && b.unlocks.length > 0;
      return {
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
        isUnlocked: !!isUnlocked,
        unlockedAt: isUnlocked && b.unlocks[0] ? b.unlocks[0].unlockedAt.toISOString() : null,
      };
    });
  }

  async checkAndUnlockBadges(userId: string, metric: string, value: any): Promise<BadgeDto[]> {
    const badges = await this.prisma.badgeDefinition.findMany({
      include: {
        unlocks: {
          where: { userId },
        },
      },
    });

    const newlyUnlocked: BadgeDto[] = [];

    for (const badge of badges) {
      if (badge.unlocks.length > 0) continue; // Already unlocked

      const criteria = badge.criteria as { metric: string; op: string; value: any };
      if (!criteria || criteria.metric !== metric) continue;

      let conditionMet = false;

      if (criteria.op === 'gte') {
        conditionMet = Number(value) >= Number(criteria.value);
      } else if (criteria.op === 'eq') {
        conditionMet = value === criteria.value;
      } else if (criteria.op === 'between' && Array.isArray(criteria.value)) {
        const [min, max] = criteria.value;
        conditionMet = Number(value) >= min && Number(value) <= max;
      }

      if (conditionMet) {
        try {
          const unlock = await this.prisma.userBadgeUnlock.create({
            data: {
              userId,
              badgeId: badge.id,
            },
          });

          this.logger.log(`User ${userId} unlocked badge ${badge.name} (${badge.slug})!`);

          // Award badge XP bonus
          await this.xpService.awardXp(
            userId,
            badge.xpReward,
            XpSource.BADGE_UNLOCK,
            `Mở khóa huy hiệu / Badge Unlocked: ${badge.nameVi}`,
          );

          const badgeDto: BadgeDto = {
            id: badge.id,
            slug: badge.slug,
            name: badge.name,
            nameVi: badge.nameVi,
            description: badge.description,
            descriptionVi: badge.descriptionVi,
            iconUrl: badge.iconUrl,
            category: badge.category,
            xpReward: badge.xpReward,
            isSecret: badge.isSecret,
            isUnlocked: true,
            unlockedAt: unlock.unlockedAt.toISOString(),
          };

          this.eventEmitter.emit('gamification.badge_unlocked', {
            userId,
            badge: badgeDto,
          });

          newlyUnlocked.push(badgeDto);
        } catch (err: any) {
          // Ignore unique constraint race conditions
          this.logger.warn(`Failed to insert badge unlock: ${err.message}`);
        }
      }
    }

    // Check Night Owl secret badge on any activity
    const currentHour = new Date().getHours();
    if (currentHour >= 0 && currentHour < 4) {
      const nightOwlBadge = badges.find(b => b.slug === 'night-owl' && b.unlocks.length === 0);
      if (nightOwlBadge) {
        try {
          const unlock = await this.prisma.userBadgeUnlock.create({
            data: {
              userId,
              badgeId: nightOwlBadge.id,
            },
          });

          await this.xpService.awardXp(
            userId,
            nightOwlBadge.xpReward,
            XpSource.BADGE_UNLOCK,
            `Mở khóa huy hiệu bí mật: Cú Đêm (${nightOwlBadge.name})`,
          );

          newlyUnlocked.push({
            id: nightOwlBadge.id,
            slug: nightOwlBadge.slug,
            name: nightOwlBadge.name,
            nameVi: nightOwlBadge.nameVi,
            description: nightOwlBadge.description,
            descriptionVi: nightOwlBadge.descriptionVi,
            iconUrl: nightOwlBadge.iconUrl,
            category: nightOwlBadge.category,
            xpReward: nightOwlBadge.xpReward,
            isSecret: nightOwlBadge.isSecret,
            isUnlocked: true,
            unlockedAt: unlock.unlockedAt.toISOString(),
          });
        } catch {
          // Ignore duplicate
        }
      }
    }

    return newlyUnlocked;
  }
}
