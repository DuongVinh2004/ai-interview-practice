import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '⚠️  NODE_ENV is set to production. Skipping demo user credential seeding for security.',
    );
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const adminEmail =
    process.env.DEMO_ADMIN_EMAIL || (isProduction ? undefined : 'admin@example.com');
  const adminPassword =
    process.env.DEMO_ADMIN_PASSWORD || (isProduction ? undefined : 'Admin@123456');
  const candidateEmail =
    process.env.DEMO_CANDIDATE_EMAIL || (isProduction ? undefined : 'candidate@example.com');
  const candidatePassword =
    process.env.DEMO_CANDIDATE_PASSWORD || (isProduction ? undefined : 'Candidate@123456');

  const passwordSalt = 10;

  // 1. Seed Demo Admin (only in non-production or if explicit env vars are provided)
  if (adminEmail && adminPassword) {
    const adminPasswordHash = await bcrypt.hash(adminPassword, passwordSalt);
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
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
  }

  // 2. Seed Demo Candidate (only in non-production or if explicit env vars are provided)
  if (candidateEmail && candidatePassword) {
    const candidatePasswordHash = await bcrypt.hash(candidatePassword, passwordSalt);
    const candidate = await prisma.user.upsert({
      where: { email: candidateEmail },
      update: {},
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
  }

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
  // 7. Seed Behavioral Competencies & Question Templates (F007)
  const behavioralCompetencies = [
    {
      slug: 'leadership',
      name: 'Leadership & Initiative',
      nameVi: 'Lãnh đạo & Tiên phong',
      description:
        'Ability to lead initiatives, take ownership, and guide team members to success.',
      category: 'LEADERSHIP' as const,
      order: 1,
    },
    {
      slug: 'teamwork',
      name: 'Teamwork & Collaboration',
      nameVi: 'Làm việc nhóm & Hợp tác',
      description:
        'Effective collaboration across cross-functional teams and managing diverse perspectives.',
      category: 'TEAMWORK' as const,
      order: 2,
    },
    {
      slug: 'problem-solving',
      name: 'Problem Solving & Conflict Resolution',
      nameVi: 'Giải quyết vấn đề & Xử lý xung đột',
      description:
        'Navigating technical and interpersonal challenges with structured analytical reasoning.',
      category: 'PROBLEM_SOLVING' as const,
      order: 3,
    },
    {
      slug: 'communication',
      name: 'Communication & Influence',
      nameVi: 'Giao tiếp & Thuyết phục',
      description: 'Articulating complex technical concepts clearly to diverse stakeholders.',
      category: 'COMMUNICATION' as const,
      order: 4,
    },
    {
      slug: 'adaptability',
      name: 'Adaptability & Continuous Learning',
      nameVi: 'Thích ứng & Học hỏi liên tục',
      description: 'Embracing rapid changes in requirements, tech stacks, and shifting priorities.',
      category: 'ADAPTABILITY' as const,
      order: 5,
    },
  ];

  for (const comp of behavioralCompetencies) {
    const createdComp = await prisma.behavioralCompetency.upsert({
      where: { slug: comp.slug },
      update: {
        name: comp.name,
        nameVi: comp.nameVi,
        description: comp.description,
        category: comp.category,
        order: comp.order,
        isActive: true,
      },
      create: comp,
    });

    // Seed preset templates for each competency
    const templates = [
      {
        companyPreset: 'GENERAL',
        templateText: `Tell me about a time when you demonstrated ${comp.name.toLowerCase()} in a critical project milestone.`,
        templateTextVi: `Hãy kể về một lần bạn thể hiện ${comp.nameVi.toLowerCase()} trong một cột mốc quan trọng của dự án.`,
        difficulty: 1,
      },
      {
        companyPreset: 'AMAZON_LEADERSHIP',
        templateText: `Give an example of a situation where you had to make a tough trade-off upholding customer obsession and high standards.`,
        templateTextVi: `Nêu một ví dụ về tình huống bạn phải đưa ra quyết định đánh đổi khó khăn để đảm bảo chất lượng và đặt khách hàng lên hàng đầu.`,
        difficulty: 2,
      },
      {
        companyPreset: 'GOOGLE_GOOGLINESS',
        templateText: `Describe how you handled ambiguity and conflicting opinions when driving an unproven architectural decision.`,
        templateTextVi: `Mô tả cách bạn xử lý sự bất định và các ý kiến trái chiều khi thúc đẩy một quyết định kiến trúc mới chưa từng thử nghiệm.`,
        difficulty: 2,
      },
    ];

    for (const tpl of templates) {
      const existing = await prisma.behavioralQuestionTemplate.findFirst({
        where: { competencyId: createdComp.id, companyPreset: tpl.companyPreset },
      });
      if (!existing) {
        await prisma.behavioralQuestionTemplate.create({
          data: {
            competencyId: createdComp.id,
            companyPreset: tpl.companyPreset,
            templateText: tpl.templateText,
            templateTextVi: tpl.templateTextVi,
            difficulty: tpl.difficulty,
          },
        });
      }
    }
  }
  console.log(`✅ Seeded ${behavioralCompetencies.length} behavioral competencies and templates`);

  // 8. Seed Subscription Plans (F014)
  const subscriptionPlans = [
    {
      slug: 'free',
      name: 'Free Tier',
      nameVi: 'Gói Miễn Phí',
      description: 'Essential practice for developers starting interview prep.',
      priceMonthly: 0,
      priceYearly: 0,
      currency: 'USD',
      features: [
        '5 interview sessions / month',
        'Standard AI feedback',
        'Live coding sandbox',
        'Community access',
      ],
      limits: {
        sessionsPerMonth: 5,
        voiceMinutesPerMonth: 0,
        allowLiveCoding: true,
        allowSystemDesign: false,
        mentorFeedbackLimit: 1,
      },
      isActive: true,
    },
    {
      slug: 'pro',
      name: 'Pro Tier',
      nameVi: 'Gói Chuyên Nghiệp',
      description: 'Comprehensive practice for active job seekers targeting top tech companies.',
      priceMonthly: 9.99,
      priceYearly: 99.99,
      currency: 'USD',
      features: [
        '50 interview sessions / month',
        '60 voice streaming minutes / month',
        'Live coding + System design whiteboard',
        'Detailed STAR behavioral assessment',
        '10 mentor share review links',
      ],
      limits: {
        sessionsPerMonth: 50,
        voiceMinutesPerMonth: 60,
        allowLiveCoding: true,
        allowSystemDesign: true,
        mentorFeedbackLimit: 10,
      },
      isActive: true,
    },
    {
      slug: 'team',
      name: 'Team & University',
      nameVi: 'Gói Nhóm & Trường Học',
      description: 'For bootcamps, universities, and engineering teams training candidates.',
      priceMonthly: 29.99,
      priceYearly: 299.99,
      currency: 'USD',
      features: [
        '500 interview sessions / month',
        '300 voice minutes / month',
        'All interview modes (Coding, Behavioral, System Design)',
        'Unlimited mentor reviews and analytics',
      ],
      limits: {
        sessionsPerMonth: 500,
        voiceMinutesPerMonth: 300,
        allowLiveCoding: true,
        allowSystemDesign: true,
        mentorFeedbackLimit: 100,
      },
      isActive: true,
    },
    {
      slug: 'enterprise',
      name: 'Enterprise Tier',
      nameVi: 'Gói Doanh Nghiệp',
      description: 'Custom solutions for high-volume hiring and enterprise assessment.',
      priceMonthly: 99.99,
      priceYearly: 999.99,
      currency: 'USD',
      features: [
        'Unlimited interview sessions',
        'Unlimited voice minutes',
        'Custom rubrics & SLA guarantee (99.9%)',
        'Dedicated account manager',
      ],
      limits: {
        sessionsPerMonth: 99999,
        voiceMinutesPerMonth: 99999,
        allowLiveCoding: true,
        allowSystemDesign: true,
        mentorFeedbackLimit: 9999,
      },
      isActive: true,
    },
  ];

  for (const plan of subscriptionPlans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        nameVi: plan.nameVi,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        currency: plan.currency,
        features: plan.features,
        limits: plan.limits,
        isActive: true,
      },
      create: plan,
    });
  }
  // 9. Seed Mentor Profile for Admin
  const mentorProfile = await prisma.mentorProfile.upsert({
    where: { userId: admin.id },
    update: {
      expertiseAreas: ['System Design', 'Backend Architecture', 'Distributed Systems'],
      bio: 'Principal Architect & Staff Engineer with 10+ years scaling large distributed platforms.',
      isActive: true,
      rating: 4.9,
      totalSessions: 24,
    },
    create: {
      userId: admin.id,
      expertiseAreas: ['System Design', 'Backend Architecture', 'Distributed Systems'],
      bio: 'Principal Architect & Staff Engineer with 10+ years scaling large distributed platforms.',
      isActive: true,
      rating: 4.9,
      totalSessions: 24,
    },
  });

  for (let day = 1; day <= 5; day++) {
    const existing = await prisma.mentorAvailability.findFirst({
      where: { mentorId: mentorProfile.id, dayOfWeek: day },
    });
    if (!existing) {
      await prisma.mentorAvailability.create({
        data: {
          mentorId: mentorProfile.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
      });
    }
  }
  console.log('✅ Seeded demo mentor profile and availability slots');

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
