import {
  PrismaClient,
  QuestionAnswerAuthority,
  QuestionPublicationStatus,
  MentorAuthorityState,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { questionBankDrafts } from './question-bank-draft-data';
import { seedArenaChallenges } from './seeds/arena-challenges.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  const adminEmail = process.env.DEMO_ADMIN_EMAIL;
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
  const candidateEmail = process.env.DEMO_CANDIDATE_EMAIL;
  const candidatePassword = process.env.DEMO_CANDIDATE_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn('⚠️  DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD not set. Skipping admin seed.');
  }
  if (!candidateEmail || !candidatePassword) {
    console.warn(
      '⚠️  DEMO_CANDIDATE_EMAIL and DEMO_CANDIDATE_PASSWORD not set. Skipping candidate seed.',
    );
  }

  const passwordSalt = 10;
  let adminUser: any = null;

  // 1. Seed Demo Admin (only in non-production or if explicit env vars are provided)
  if (adminEmail && adminPassword) {
    const adminPasswordHash = await bcrypt.hash(adminPassword, passwordSalt);
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
    adminUser = admin;
    console.log(`✅ Admin user seeded: ${admin.email}`);
  }

  // 2. Seed Demo Candidate (only in non-production or if explicit env vars are provided)
  if (candidateEmail && candidatePassword) {
    const candidatePasswordHash = await bcrypt.hash(candidatePassword, passwordSalt);
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
      slug: 'mobile-engineer',
      name: 'Mobile App Engineer',
      description:
        'Focuses on native and cross-platform mobile apps (iOS, Android, Flutter, React Native).',
    },
    {
      slug: 'devops-engineer',
      name: 'DevOps & Platform Engineer',
      description:
        'Focuses on CI/CD pipelines, containerization, cloud infrastructure, and observability.',
    },
    {
      slug: 'ai-ml-engineer',
      name: 'AI / Machine Learning Engineer',
      description:
        'Focuses on machine learning models, deep learning, LLMs, RAG, and AI system integration.',
    },
    {
      slug: 'data-engineer',
      name: 'Data Engineer',
      description:
        'Focuses on data pipelines (ETL/ELT), data warehousing, stream processing, and big data architecture.',
    },
    {
      slug: 'data-analyst-scientist',
      name: 'Data Scientist & Analyst',
      description:
        'Focuses on statistical analysis, data modeling, exploratory analysis, and business intelligence.',
    },
    {
      slug: 'cloud-solutions-architect',
      name: 'Cloud & Solutions Architect',
      description:
        'Focuses on high-availability cloud architecture, system trade-offs, and multi-cloud solutions.',
    },
    {
      slug: 'security-engineer',
      name: 'Security & DevSecOps Engineer',
      description:
        'Focuses on application security, vulnerability management, IAM, threat modeling, and OWASP.',
    },
    {
      slug: 'qa-qc-automation-engineer',
      name: 'QA & Automation Test Engineer',
      description:
        'Focuses on test automation, end-to-end testing, quality assurance frameworks, and load testing.',
    },
    {
      slug: 'embedded-iot-engineer',
      name: 'Embedded & IoT Engineer',
      description:
        'Focuses on C/C++, firmware, RTOS, microcontrollers, and IoT communication protocols.',
    },
    {
      slug: 'engineering-manager-tech-lead',
      name: 'Tech Lead & Engineering Manager',
      description:
        'Focuses on technical leadership, architectural governance, mentoring, and software delivery.',
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
      slug: 'fresher',
      name: 'Fresher',
      order: 1,
      description:
        '0-1 year of experience; focus on core CS fundamentals, data structures, and basic syntax.',
    },
    {
      slug: 'junior',
      name: 'Junior',
      order: 2,
      description:
        '1-2 years of experience; focus on practical implementation, framework fundamentals, and clean code.',
    },
    {
      slug: 'mid-level',
      name: 'Mid-Level',
      order: 3,
      description:
        '2-5 years of experience; focus on practical design patterns, debugging, and independence.',
    },
    {
      slug: 'senior',
      name: 'Senior',
      order: 4,
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
    // Languages
    { slug: 'typescript', name: 'TypeScript', category: 'Language' },
    { slug: 'javascript', name: 'JavaScript', category: 'Language' },
    { slug: 'python', name: 'Python', category: 'Language' },
    { slug: 'java', name: 'Java', category: 'Language' },
    { slug: 'golang', name: 'Go (Golang)', category: 'Language' },
    { slug: 'csharp', name: 'C# (.NET)', category: 'Language' },
    { slug: 'cpp', name: 'C++', category: 'Language' },
    { slug: 'rust', name: 'Rust', category: 'Language' },
    { slug: 'php', name: 'PHP', category: 'Language' },
    { slug: 'swift', name: 'Swift', category: 'Language' },
    { slug: 'kotlin', name: 'Kotlin', category: 'Language' },

    // Frontend
    { slug: 'react', name: 'React', category: 'Frontend' },
    { slug: 'nextjs', name: 'Next.js', category: 'Frontend' },
    { slug: 'vue', name: 'Vue.js', category: 'Frontend' },
    { slug: 'angular', name: 'Angular', category: 'Frontend' },
    { slug: 'tailwind-css', name: 'Tailwind CSS', category: 'Frontend' },
    { slug: 'html5-css3', name: 'HTML5 & CSS3', category: 'Frontend' },

    // Mobile
    { slug: 'flutter', name: 'Flutter', category: 'Mobile' },
    { slug: 'react-native', name: 'React Native', category: 'Mobile' },
    { slug: 'ios-swift', name: 'iOS (Swift)', category: 'Mobile' },
    { slug: 'android-kotlin', name: 'Android (Kotlin)', category: 'Mobile' },

    // Backend
    { slug: 'nodejs', name: 'Node.js', category: 'Backend' },
    { slug: 'nestjs', name: 'NestJS', category: 'Backend' },
    { slug: 'expressjs', name: 'Express.js', category: 'Backend' },
    { slug: 'spring-boot', name: 'Spring Boot', category: 'Backend' },
    { slug: 'django', name: 'Django', category: 'Backend' },
    { slug: 'fastapi', name: 'FastAPI', category: 'Backend' },
    { slug: 'aspnet-core', name: 'ASP.NET Core', category: 'Backend' },
    { slug: 'gin-gorm', name: 'Gin / GORM', category: 'Backend' },
    { slug: 'laravel', name: 'Laravel', category: 'Backend' },

    // Database & Caching
    { slug: 'postgresql', name: 'PostgreSQL', category: 'Database' },
    { slug: 'mysql', name: 'MySQL', category: 'Database' },
    { slug: 'mongodb', name: 'MongoDB', category: 'Database' },
    { slug: 'redis', name: 'Redis', category: 'Database' },
    { slug: 'elasticsearch', name: 'Elasticsearch', category: 'Database' },
    { slug: 'cassandra', name: 'Cassandra', category: 'Database' },
    { slug: 'dynamodb', name: 'DynamoDB', category: 'Database' },

    // API & Messaging
    { slug: 'graphql', name: 'GraphQL', category: 'API' },
    { slug: 'grpc', name: 'gRPC & Protocol Buffers', category: 'API' },
    { slug: 'rest-api', name: 'RESTful API', category: 'API' },
    { slug: 'kafka', name: 'Apache Kafka', category: 'API' },
    { slug: 'rabbitmq', name: 'RabbitMQ', category: 'API' },
    { slug: 'websocket', name: 'WebSocket & Realtime', category: 'API' },

    // Cloud & DevOps
    { slug: 'docker', name: 'Docker', category: 'DevOps' },
    { slug: 'kubernetes', name: 'Kubernetes (K8s)', category: 'DevOps' },
    { slug: 'aws', name: 'AWS (Amazon Web Services)', category: 'DevOps' },
    { slug: 'gcp', name: 'Google Cloud Platform (GCP)', category: 'DevOps' },
    { slug: 'azure', name: 'Microsoft Azure', category: 'DevOps' },
    { slug: 'terraform', name: 'Terraform & IaC', category: 'DevOps' },
    { slug: 'cicd-github-actions', name: 'CI/CD & GitHub Actions', category: 'DevOps' },
    { slug: 'linux-systems', name: 'Linux Systems & Shell', category: 'DevOps' },

    // AI & Big Data
    { slug: 'pytorch', name: 'PyTorch', category: 'AI/Data' },
    { slug: 'tensorflow', name: 'TensorFlow', category: 'AI/Data' },
    { slug: 'langchain-rag', name: 'LangChain & RAG', category: 'AI/Data' },
    { slug: 'pandas-numpy', name: 'Pandas & NumPy', category: 'AI/Data' },
    { slug: 'spark', name: 'Apache Spark', category: 'AI/Data' },

    // Testing & Security
    { slug: 'playwright', name: 'Playwright', category: 'Testing' },
    { slug: 'cypress', name: 'Cypress', category: 'Testing' },
    { slug: 'selenium', name: 'Selenium', category: 'Testing' },
    { slug: 'jest-vitest', name: 'Jest / Vitest', category: 'Testing' },
    { slug: 'owasp-security', name: 'OWASP Security & AppSec', category: 'Security' },
    { slug: 'jmeter-k6', name: 'k6 / JMeter (Performance)', category: 'Testing' },
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

  // 9. Seed Question Bank content for the public Question Bank.
  // The product owner explicitly chose direct publication for this seed corpus.
  const contentAuthor =
    adminUser ??
    (await prisma.user.findFirst({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      orderBy: { createdAt: 'asc' },
    }));

  if (!contentAuthor) {
    console.warn(
      '⚠️  No active admin account found. Skipping Question Bank drafts because a traceable editorial author is required.',
    );
  } else {
    const [seededRoles, seededLevels, seededTechnologies] = await Promise.all([
      prisma.jobRole.findMany({ select: { id: true, slug: true } }),
      prisma.seniorityLevel.findMany({ select: { id: true, slug: true } }),
      prisma.technology.findMany({ select: { id: true, slug: true } }),
    ]);
    const roleIds = new Map(seededRoles.map(role => [role.slug, role.id]));
    const levelIds = new Map(seededLevels.map(level => [level.slug, level.id]));
    const technologyIds = new Map(
      seededTechnologies.map(technology => [technology.slug, technology.id]),
    );
    let createdQuestionCount = 0;
    let publishedExistingCount = 0;

    for (const draft of questionBankDrafts) {
      const jobRoleId = roleIds.get(draft.role);
      const seniorityLevelId = levelIds.get(draft.seniority);
      const technologyIdsForDraft = draft.technologies.map(slug => technologyIds.get(slug));

      if (!jobRoleId || !seniorityLevelId || technologyIdsForDraft.some(id => !id)) {
        throw new Error(`Question Bank draft taxonomy is invalid for ${draft.slug}`);
      }

      const existing = await prisma.questionBankQuestion.findUnique({
        where: { slug: draft.slug },
        include: {
          answers: { orderBy: { version: 'desc' }, take: 1 },
        },
      });
      if (existing) {
        const latestAnswer = existing.answers[0];
        if (
          existing.status !== QuestionPublicationStatus.PUBLISHED ||
          !latestAnswer?.isPublished ||
          existing.currentAnswerId !== latestAnswer?.id
        ) {
          await prisma.$transaction(async tx => {
            if (latestAnswer && !latestAnswer.isPublished) {
              await tx.questionBankAnswer.update({
                where: { id: latestAnswer.id },
                data: { isPublished: true },
              });
            }
            await tx.questionBankQuestion.update({
              where: { id: existing.id },
              data: {
                status: QuestionPublicationStatus.PUBLISHED,
                currentAnswerId: latestAnswer?.id,
                publishedAt: existing.publishedAt ?? new Date(),
              },
            });
          });
          publishedExistingCount += 1;
        }
        continue;
      }

      const created = await prisma.questionBankQuestion.create({
        data: {
          slug: draft.slug,
          title: draft.title,
          questionBody: draft.questionBody,
          questionType: draft.questionType,
          difficulty: draft.difficulty,
          language: 'vi',
          status: QuestionPublicationStatus.PUBLISHED,
          publishedAt: new Date(),
          createdById: contentAuthor.id,
          jobRoleId,
          seniorityLevelId,
          technologies: {
            create: technologyIdsForDraft.map(technologyId => ({ technologyId: technologyId! })),
          },
          answers: {
            create: {
              version: 1,
              authority: QuestionAnswerAuthority[draft.authority],
              answerBody: draft.answerBody,
              explanationBody: draft.explanationBody,
              rubric: draft.rubric,
              commonMistakes: draft.commonMistakes,
              sourceType: 'seed-curated',
              isPublished: true,
            },
          },
        },
        include: {
          answers: { select: { id: true }, take: 1 },
        },
      });
      await prisma.questionBankQuestion.update({
        where: { id: created.id },
        data: { currentAnswerId: created.answers[0]?.id },
      });
      createdQuestionCount += 1;
    }
    console.log(
      `✅ Question Bank content: ${createdQuestionCount} created and published, ${publishedExistingCount} existing questions published`,
    );
  }

  // 10. Seed Mentor Profile for Admin
  if (adminUser) {
    const mentorProfile = await prisma.mentorProfile.upsert({
      where: { userId: adminUser.id },
      update: {
        expertiseAreas: ['System Design', 'Backend Architecture', 'Distributed Systems'],
        bio: 'Principal Architect & Staff Engineer with 10+ years scaling large distributed platforms.',
        // Preserve the current authority state. Approval is an audited admin API action.
        rating: 4.9,
        totalSessions: 24,
      },
      create: {
        userId: adminUser.id,
        expertiseAreas: ['System Design', 'Backend Architecture', 'Distributed Systems'],
        bio: 'Principal Architect & Staff Engineer with 10+ years scaling large distributed platforms.',
        isActive: false,
        authorityState: MentorAuthorityState.PENDING,
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
  }
  console.log('✅ Seeded demo mentor profile and availability slots');

  // 11. Seed Engineering Arena Benchmark Challenges (F017)
  await seedArenaChallenges();

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
