import {
  USER_LEVELS_SEED,
  BADGE_DEFINITIONS_SEED,
  seedUserLevelsAndBadges,
} from '../prisma/seeds/gamification.seed';

describe('Gamification Seed — UserLevel & BadgeDefinition (Task 1.3)', () => {
  it('defines 20 UserLevels with correct XP formula and titles', () => {
    expect(USER_LEVELS_SEED).toHaveLength(20);

    USER_LEVELS_SEED.forEach((ul, index) => {
      const expectedLevel = index + 1;
      expect(ul.level).toBe(expectedLevel);
      const expectedXp = Math.round(100 * Math.pow(expectedLevel, 1.5));
      expect(ul.xpThreshold).toBe(expectedXp);
      expect(ul.iconUrl).toBeNull();
      expect(ul.title).toBeDefined();
      expect(ul.titleVi).toBeDefined();
    });

    const level1 = USER_LEVELS_SEED.find(l => l.level === 1);
    expect(level1?.title).toBe('Rookie');
    expect(level1?.titleVi).toBe('Tân binh');

    const level5 = USER_LEVELS_SEED.find(l => l.level === 5);
    expect(level5?.title).toBe('Apprentice');
    expect(level5?.titleVi).toBe('Học việc');

    const level10 = USER_LEVELS_SEED.find(l => l.level === 10);
    expect(level10?.title).toBe('Expert');
    expect(level10?.titleVi).toBe('Chuyên gia');

    const level20 = USER_LEVELS_SEED.find(l => l.level === 20);
    expect(level20?.title).toBe('Grandmaster');
    expect(level20?.titleVi).toBe('Đại sư');
  });

  it('defines >= 10 BadgeDefinitions with required keys and valid criteria', () => {
    expect(BADGE_DEFINITIONS_SEED.length).toBeGreaterThanOrEqual(10);

    const requiredSlugs = [
      'first_interview',
      'streak_7',
      'streak_30',
      'perfect_score',
      'speed_demon',
      'night_owl',
      'early_bird',
      'polyglot',
      'arena_champion',
      'mentor_star',
    ];

    const definedSlugs = BADGE_DEFINITIONS_SEED.map(b => b.slug);
    for (const slug of requiredSlugs) {
      expect(definedSlugs).toContain(slug);
    }

    for (const badge of BADGE_DEFINITIONS_SEED) {
      expect(badge.slug).toBeDefined();
      expect(badge.name).toBeDefined();
      expect(badge.description).toBeDefined();
      expect(badge.criteria).toBeDefined();
      expect(typeof badge.criteria).toBe('object');
      expect((badge.criteria as any).metric).toBeDefined();
    }
  });

  it('executes idempotent upserts for user levels and badges against Prisma', async () => {
    const mockPrisma = {
      userLevel: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      badgeDefinition: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    await seedUserLevelsAndBadges(mockPrisma as any);

    expect(mockPrisma.userLevel.upsert).toHaveBeenCalledTimes(20);
    expect(mockPrisma.badgeDefinition.upsert).toHaveBeenCalledTimes(BADGE_DEFINITIONS_SEED.length);

    expect(mockPrisma.userLevel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { level: 1 },
        create: expect.objectContaining({
          level: 1,
          title: 'Rookie',
          titleVi: 'Tân binh',
          iconUrl: null,
        }),
      }),
    );

    expect(mockPrisma.badgeDefinition.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'first_interview' },
        create: expect.objectContaining({ slug: 'first_interview' }),
      }),
    );
  });
});
