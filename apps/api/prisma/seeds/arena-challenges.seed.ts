import { PrismaClient, ArenaChallengeStatus } from '@prisma/client';
import { BENCHMARK_CHALLENGES } from '../../src/modules/engineering-arena/fixtures/benchmark-challenges';

const prisma = new PrismaClient();

export async function seedArenaChallenges() {
  console.log('Seeding 5 Engineering Arena Benchmark Challenges...');

  for (const fixture of BENCHMARK_CHALLENGES) {
    const { manifest } = fixture;

    const challenge = await prisma.engineeringChallenge.upsert({
      where: { slug: manifest.slug },
      update: {
        title: manifest.title,
        domain: manifest.domain as any,
        category: manifest.category as any,
        difficulty: manifest.difficulty,
        estimatedMinutes: manifest.estimatedMinutes,
        status: ArenaChallengeStatus.PUBLISHED,
      },
      create: {
        slug: manifest.slug,
        title: manifest.title,
        domain: manifest.domain as any,
        category: manifest.category as any,
        difficulty: manifest.difficulty,
        estimatedMinutes: manifest.estimatedMinutes,
        status: ArenaChallengeStatus.PUBLISHED,
      },
    });

    await prisma.engineeringChallengeVersion.upsert({
      where: {
        challengeId_versionNumber: {
          challengeId: challenge.id,
          versionNumber: 1,
        },
      },
      update: {
        manifestJson: manifest as any,
        validationSummary: 'Initial benchmark release version 1.0',
      },
      create: {
        challengeId: challenge.id,
        versionNumber: 1,
        manifestJson: manifest as any,
        validationSummary: 'Initial benchmark release version 1.0',
      },
    });

    console.log(`✓ Seeded challenge: ${manifest.slug} (${manifest.title})`);
  }

  console.log('Successfully seeded all 5 Engineering Arena challenges.');
}

if (require.main === module) {
  seedArenaChallenges()
    .catch(e => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
