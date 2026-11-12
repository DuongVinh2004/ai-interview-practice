import { PrismaClient } from '@prisma/client';

export interface UserLevelSeedItem {
  level: number;
  xpThreshold: number;
  title: string;
  titleVi: string;
  iconUrl: string | null;
}

export interface BadgeDefinitionSeedItem {
  slug: string;
  name: string;
  nameVi: string;
  description: string;
  descriptionVi: string;
  iconUrl: string;
  category: string;
  criteria: Record<string, any>;
  xpReward: number;
  isSecret: boolean;
}

const LEVEL_NAMES: Record<number, { en: string; vi: string }> = {
  1: { en: 'Rookie', vi: 'Tân binh' },
  2: { en: 'Novice', vi: 'Tập sự' },
  3: { en: 'Trainee', vi: 'Thực tập sinh' },
  4: { en: 'Junior', vi: 'Sơ cấp' },
  5: { en: 'Apprentice', vi: 'Học việc' },
  6: { en: 'Specialist', vi: 'Chuyên viên' },
  7: { en: 'Practitioner', vi: 'Kỹ sư thực hành' },
  8: { en: 'Associate', vi: 'Chuyên viên cộng tác' },
  9: { en: 'Intermediate', vi: 'Trung cấp' },
  10: { en: 'Expert', vi: 'Chuyên gia' },
  11: { en: 'Advanced', vi: 'Kỹ sư nâng cao' },
  12: { en: 'Professional', vi: 'Chuyên nghiệp' },
  13: { en: 'Senior', vi: 'Cao cấp' },
  14: { en: 'Lead', vi: 'Trưởng nhóm' },
  15: { en: 'Staff Engineer', vi: 'Kỹ sư chủ chốt' },
  16: { en: 'Principal', vi: 'Kỹ sư trưởng' },
  17: { en: 'Distinguished', vi: 'Kỹ sư xuất sắc' },
  18: { en: 'Master', vi: 'Bậc thầy' },
  19: { en: 'Legend', vi: 'Huyền thoại' },
  20: { en: 'Grandmaster', vi: 'Đại sư' },
};

export const USER_LEVELS_SEED: UserLevelSeedItem[] = Array.from({ length: 20 }, (_, i) => {
  const level = i + 1;
  const xpThreshold = Math.round(100 * Math.pow(level, 1.5));
  const naming = LEVEL_NAMES[level] || { en: `Level ${level}`, vi: `Cấp ${level}` };
  return {
    level,
    xpThreshold,
    title: naming.en,
    titleVi: naming.vi,
    iconUrl: null,
  };
});

export const BADGE_DEFINITIONS_SEED: BadgeDefinitionSeedItem[] = [
  {
    slug: 'first_interview',
    name: 'First Interview',
    nameVi: 'Phỏng Vấn Đầu Tiên',
    description: 'Complete your first technical mock interview session.',
    descriptionVi: 'Hoàn thành buổi phỏng vấn kỹ thuật thử nghiệm đầu tiên của bạn.',
    iconUrl: '/icons/badges/first_interview.svg',
    category: 'INTERVIEW',
    xpReward: 50,
    isSecret: false,
    criteria: { metric: 'completed_interviews', op: 'gte', value: 1 },
  },
  {
    slug: 'streak_7',
    name: '7-Day Streak',
    nameVi: 'Chuỗi 7 Ngày',
    description: 'Maintain an uninterrupted 7-day practice streak.',
    descriptionVi: 'Duy trì chuỗi học tập 7 ngày liên tiếp không ngắt quãng.',
    iconUrl: '/icons/badges/streak_7.svg',
    category: 'STREAK',
    xpReward: 100,
    isSecret: false,
    criteria: { metric: 'current_streak', op: 'gte', value: 7 },
  },
  {
    slug: 'streak_30',
    name: '30-Day Legend',
    nameVi: 'Huyền Thoại 30 Ngày',
    description: 'Achieve a legendary 30-day practice streak.',
    descriptionVi: 'Đạt cột mốc chuỗi học tập 30 ngày huyền thoại.',
    iconUrl: '/icons/badges/streak_30.svg',
    category: 'STREAK',
    xpReward: 300,
    isSecret: false,
    criteria: { metric: 'current_streak', op: 'gte', value: 30 },
  },
  {
    slug: 'perfect_score',
    name: 'Perfect Score',
    nameVi: 'Điểm Tuyệt Đối',
    description: 'Score a perfect 10.0 or 100% on an evaluation benchmark.',
    descriptionVi: 'Đạt điểm số tuyệt đối trong một lượt đánh giá phỏng vấn.',
    iconUrl: '/icons/badges/perfect_score.svg',
    category: 'INTERVIEW',
    xpReward: 150,
    isSecret: false,
    criteria: { metric: 'perfect_score_count', op: 'gte', value: 1 },
  },
  {
    slug: 'speed_demon',
    name: 'Speed Demon',
    nameVi: 'Tốc Độ Thần Tốc',
    description: 'Solve a coding challenge in under 5 minutes.',
    descriptionVi: 'Giải bài toán lập trình trong dưới 5 phút.',
    iconUrl: '/icons/badges/speed_demon.svg',
    category: 'CODING',
    xpReward: 75,
    isSecret: false,
    criteria: { metric: 'solve_time_seconds', op: 'lte', value: 300 },
  },
  {
    slug: 'night_owl',
    name: 'Night Owl',
    nameVi: 'Cú Đêm Luyện Tập',
    description: 'Practice an interview or problem session between 00:00 and 04:00.',
    descriptionVi: 'Luyện tập phỏng vấn hoặc giải bài trong khung giờ từ 00:00 đến 04:00.',
    iconUrl: '/icons/badges/night_owl.svg',
    category: 'LEARNING',
    xpReward: 50,
    isSecret: true,
    criteria: { metric: 'hour_of_day', op: 'between', value: [0, 4] },
  },
  {
    slug: 'early_bird',
    name: 'Early Bird',
    nameVi: 'Chim Sớm Chăm Chỉ',
    description: 'Complete a practice session between 05:00 and 07:00.',
    descriptionVi: 'Hoàn thành buổi luyện tập trong khung giờ từ 05:00 đến 07:00.',
    iconUrl: '/icons/badges/early_bird.svg',
    category: 'LEARNING',
    xpReward: 50,
    isSecret: false,
    criteria: { metric: 'hour_of_day', op: 'between', value: [5, 7] },
  },
  {
    slug: 'polyglot',
    name: 'Polyglot',
    nameVi: 'Đa Ngôn Ngữ',
    description: 'Complete coding challenges in 3 or more distinct languages.',
    descriptionVi: 'Giải quyết các bài toán coding bằng từ 3 ngôn ngữ lập trình khác nhau.',
    iconUrl: '/icons/badges/polyglot.svg',
    category: 'CODING',
    xpReward: 120,
    isSecret: false,
    criteria: { metric: 'distinct_languages_used', op: 'gte', value: 3 },
  },
  {
    slug: 'arena_champion',
    name: 'Arena Champion',
    nameVi: 'Quán Quân Đấu Trường',
    description: 'Win first place in an Engineering Arena competition.',
    descriptionVi: 'Đạt vị trí quán quân trong đấu trường Engineering Arena.',
    iconUrl: '/icons/badges/arena_champion.svg',
    category: 'ARENA',
    xpReward: 200,
    isSecret: false,
    criteria: { metric: 'arena_wins', op: 'gte', value: 1 },
  },
  {
    slug: 'mentor_star',
    name: 'Mentor Star',
    nameVi: 'Ngôi Sao Cố Vấn',
    description: 'Receive top feedback rating in a 1-on-1 mentorship session.',
    descriptionVi: 'Nhận đánh giá xuất sắc trong một buổi cố vấn 1 kèm 1.',
    iconUrl: '/icons/badges/mentor_star.svg',
    category: 'MENTOR',
    xpReward: 150,
    isSecret: false,
    criteria: { metric: 'mentorship_rating', op: 'gte', value: 4.8 },
  },
];

export async function seedUserLevelsAndBadges(prisma: PrismaClient) {
  console.log('Seeding 20 User Levels...');
  for (const levelData of USER_LEVELS_SEED) {
    await prisma.userLevel.upsert({
      where: { level: levelData.level },
      update: {
        xpThreshold: levelData.xpThreshold,
        title: levelData.title,
        titleVi: levelData.titleVi,
        iconUrl: levelData.iconUrl,
      },
      create: {
        level: levelData.level,
        xpThreshold: levelData.xpThreshold,
        title: levelData.title,
        titleVi: levelData.titleVi,
        iconUrl: levelData.iconUrl,
      },
    });
  }
  console.log(`✓ Seeded ${USER_LEVELS_SEED.length} user levels`);

  console.log('Seeding Badge Definitions...');
  for (const badge of BADGE_DEFINITIONS_SEED) {
    await prisma.badgeDefinition.upsert({
      where: { slug: badge.slug },
      update: {
        name: badge.name,
        nameVi: badge.nameVi,
        description: badge.description,
        descriptionVi: badge.descriptionVi,
        iconUrl: badge.iconUrl,
        category: badge.category,
        criteria: badge.criteria,
        xpReward: badge.xpReward,
        isSecret: badge.isSecret,
      },
      create: {
        slug: badge.slug,
        name: badge.name,
        nameVi: badge.nameVi,
        description: badge.description,
        descriptionVi: badge.descriptionVi,
        iconUrl: badge.iconUrl,
        category: badge.category,
        criteria: badge.criteria,
        xpReward: badge.xpReward,
        isSecret: badge.isSecret,
      },
    });
  }
  console.log(`✓ Seeded ${BADGE_DEFINITIONS_SEED.length} badge definitions`);
}
