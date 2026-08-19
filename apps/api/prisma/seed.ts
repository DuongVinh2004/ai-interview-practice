import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  const adminEmail = process.env.DEMO_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD || 'Admin@123456';
  const candidateEmail = process.env.DEMO_CANDIDATE_EMAIL || 'candidate@example.com';
  const candidatePassword = process.env.DEMO_CANDIDATE_PASSWORD || 'Candidate@123456';

  const passwordSalt = 10;
  const adminPasswordHash = await bcrypt.hash(adminPassword, passwordSalt);
  const candidatePasswordHash = await bcrypt.hash(candidatePassword, passwordSalt);

  // 1. Seed Demo Admin
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          fullName: 'System Administrator',
          targetRole: 'Administrator',
          targetLevel: 'Staff',
          bio: 'Demo administrator account',
        },
      },
    },
  });
  console.log(`✅ Admin user seeded: ${admin.email}`);

  // 2. Seed Demo Candidate
  const candidate = await prisma.user.upsert({
    where: { email: candidateEmail },
    update: {
      passwordHash: candidatePasswordHash,
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: candidateEmail,
      passwordHash: candidatePasswordHash,
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          fullName: 'Demo Candidate',
          targetRole: 'Frontend Engineer',
          targetLevel: 'Mid-Level',
          bio: 'Passionate developer practicing for technical interviews.',
        },
      },
    },
  });
  console.log(`✅ Candidate user seeded: ${candidate.email}`);

  // 3. Seed Job Roles
  const jobRoles = [
    {
      slug: 'frontend-engineer',
      name: 'Frontend Engineer',
      description:
        'Focuses on user interfaces, web standards, performance, and client-side architecture.',
    },
    {
      slug: 'backend-engineer',
      name: 'Backend Engineer',
      description:
        'Focuses on server-side logic, APIs, database design, caching, and scalable architecture.',
    },
    {
      slug: 'fullstack-engineer',
      name: 'Full-Stack Engineer',
      description:
        'Covers end-to-end web development spanning frontend UI, backend APIs, and data storage.',
    },
    {
      slug: 'devops-engineer',
      name: 'DevOps Engineer',
      description:
        'Focuses on CI/CD pipelines, containerization, cloud infrastructure, and observability.',
    },
  ];

  for (const role of jobRoles) {
    await prisma.jobRole.upsert({
      where: { slug: role.slug },
      update: { name: role.name, description: role.description, isActive: true },
      create: role,
    });
  }
  console.log(`✅ Seeded ${jobRoles.length} job roles`);

  // 4. Seed Seniority Levels
  const seniorityLevels = [
    {
      slug: 'junior',
      name: 'Junior',
      order: 1,
      description: '0-2 years of experience; focus on fundamentals and clean code.',
    },
    {
      slug: 'mid-level',
      name: 'Mid-Level',
      order: 2,
      description:
        '2-5 years of experience; focus on practical design patterns, debugging, and independence.',
    },
    {
      slug: 'senior',
      name: 'Senior',
      order: 3,
      description:
        '5+ years of experience; focus on architecture, trade-offs, scaling, and system design.',
    },
  ];

  for (const level of seniorityLevels) {
    await prisma.seniorityLevel.upsert({
      where: { slug: level.slug },
      update: {
        name: level.name,
        order: level.order,
        description: level.description,
        isActive: true,
      },
      create: level,
    });
  }
  console.log(`✅ Seeded ${seniorityLevels.length} seniority levels`);

  // 5. Seed Technologies
  const technologies = [
    { slug: 'typescript', name: 'TypeScript', category: 'Language' },
    { slug: 'react', name: 'React', category: 'Frontend' },
    { slug: 'nodejs', name: 'Node.js', category: 'Backend' },
    { slug: 'nestjs', name: 'NestJS', category: 'Backend' },
    { slug: 'postgresql', name: 'PostgreSQL', category: 'Database' },
    { slug: 'redis', name: 'Redis', category: 'Database' },
    { slug: 'docker', name: 'Docker', category: 'DevOps' },
    { slug: 'graphql', name: 'GraphQL', category: 'API' },
  ];

  for (const tech of technologies) {
    await prisma.technology.upsert({
      where: { slug: tech.slug },
      update: { name: tech.name, category: tech.category, isActive: true },
      create: tech,
    });
  }
  console.log(`✅ Seeded ${technologies.length} technologies`);

  // 6. Seed Prompt Versions
  const promptVersions = [
    {
      slug: 'question_generator',
      version: 1,
      systemPrompt:
        'You are an expert technical interviewer assessing a candidate for an IT position. Generate one insightful, scenario-based technical interview question tailored to the candidate role, seniority level, chosen technologies, and current difficulty level.',
      userPromptTemplate:
        'Role: {{role}}\nLevel: {{level}}\nTechnologies: {{technologies}}\nTurn Number: {{turnNumber}} of 5\nDifficulty: {{difficulty}} (1: Easy, 2: Medium, 3: Hard)\nPrevious score: {{previousScore}}\n\nGenerate the next interview question in JSON matching the required schema.',
      isActive: true,
    },
    {
      slug: 'answer_evaluator',
      version: 1,
      systemPrompt:
        'You are a senior technical interviewer evaluating a candidate answer. Score the answer strictly based on technical accuracy, depth, and clarity from 0.0 to 10.0. Provide actionable strengths, improvement points, concise feedback, and specific quoted evidence.',
      userPromptTemplate:
        'Question: {{question}}\nKey Focus: {{keyFocus}}\nExpected Key Points: {{expectedPoints}}\nCandidate Answer: {{answer}}\nSeniority Level: {{level}}\n\nEvaluate the answer and return the JSON matching the required schema.',
      isActive: true,
    },
    {
      slug: 'learning_path',
      version: 1,
      systemPrompt:
        'You are an engineering career mentor. Based on all 5 interview questions, answers, and evaluations, identify key knowledge gaps and create an actionable, structured learning path with topics, priorities, recommended actions, and search keywords. Do NOT generate external URLs.',
      userPromptTemplate:
        'Candidate Role: {{role}} ({{level}})\nInterview Turns Summary:\n{{turnsSummary}}\nOverall Score: {{overallScore}}\n\nGenerate the learning path JSON matching the required schema.',
      isActive: true,
    },
  ];

  for (const pv of promptVersions) {
    await prisma.promptVersion.upsert({
      where: {
        slug_version: {
          slug: pv.slug,
          version: pv.version,
        },
      },
      update: {
        systemPrompt: pv.systemPrompt,
        userPromptTemplate: pv.userPromptTemplate,
        isActive: pv.isActive,
      },
      create: pv,
    });
  }
  console.log(`✅ Seeded ${promptVersions.length} prompt versions`);

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch(e => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
