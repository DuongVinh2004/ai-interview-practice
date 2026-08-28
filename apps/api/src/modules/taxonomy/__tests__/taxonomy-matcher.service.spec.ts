import { Test, TestingModule } from '@nestjs/testing';
import { TaxonomyMatcherService } from '../taxonomy-matcher.service';
import { SessionMode } from '@ai-interview/contracts';

describe('TaxonomyMatcherService', () => {
  let matcher: TaxonomyMatcherService;

  const mockJobRoles = [
    {
      id: 'role-fe-id',
      slug: 'frontend-engineer',
      name: 'Frontend Engineer',
    },
    {
      id: 'role-be-id',
      slug: 'backend-engineer',
      name: 'Backend Engineer',
    },
    {
      id: 'role-fs-id',
      slug: 'fullstack-engineer',
      name: 'Full-Stack Engineer',
    },
    {
      id: 'role-devops-id',
      slug: 'devops-engineer',
      name: 'DevOps Engineer',
    },
    {
      id: 'role-mobile-id',
      slug: 'mobile-engineer',
      name: 'Mobile App Engineer',
    },
    {
      id: 'role-aiml-id',
      slug: 'ai-ml-engineer',
      name: 'AI / Machine Learning Engineer',
    },
    {
      id: 'role-de-id',
      slug: 'data-engineer',
      name: 'Data Engineer',
    },
    {
      id: 'role-ds-id',
      slug: 'data-analyst-scientist',
      name: 'Data Scientist & Analyst',
    },
    {
      id: 'role-arch-id',
      slug: 'cloud-solutions-architect',
      name: 'Cloud & Solutions Architect',
    },
    {
      id: 'role-sec-id',
      slug: 'security-engineer',
      name: 'Security & DevSecOps Engineer',
    },
    {
      id: 'role-qa-id',
      slug: 'qa-qc-automation-engineer',
      name: 'QA & Automation Test Engineer',
    },
    {
      id: 'role-embedded-id',
      slug: 'embedded-iot-engineer',
      name: 'Embedded & IoT Engineer',
    },
    {
      id: 'role-lead-id',
      slug: 'engineering-manager-tech-lead',
      name: 'Tech Lead & Engineering Manager',
    },
  ];

  const mockLevels = [
    {
      id: 'lvl-fr-id',
      slug: 'fresher',
      name: 'Fresher',
      order: 1,
    },
    {
      id: 'lvl-jr-id',
      slug: 'junior',
      name: 'Junior',
      order: 2,
    },
    {
      id: 'lvl-mid-id',
      slug: 'mid-level',
      name: 'Mid-Level',
      order: 3,
    },
    {
      id: 'lvl-sr-id',
      slug: 'senior',
      name: 'Senior',
      order: 4,
    },
  ];

  const mockTechnologies = [
    { id: 'tech-ts-id', slug: 'typescript', name: 'TypeScript', category: 'Language' },
    { id: 'tech-python-id', slug: 'python', name: 'Python', category: 'Language' },
    { id: 'tech-go-id', slug: 'golang', name: 'Go (Golang)', category: 'Language' },
    { id: 'tech-react-id', slug: 'react', name: 'React', category: 'Frontend' },
    { id: 'tech-flutter-id', slug: 'flutter', name: 'Flutter', category: 'Mobile' },
    { id: 'tech-rn-id', slug: 'react-native', name: 'React Native', category: 'Mobile' },
    { id: 'tech-node-id', slug: 'nodejs', name: 'Node.js', category: 'Backend' },
    { id: 'tech-express-id', slug: 'expressjs', name: 'Express.js', category: 'Backend' },
    { id: 'tech-nest-id', slug: 'nestjs', name: 'NestJS', category: 'Backend' },
    { id: 'tech-spring-id', slug: 'spring-boot', name: 'Spring Boot', category: 'Backend' },
    { id: 'tech-fastapi-id', slug: 'fastapi', name: 'FastAPI', category: 'Backend' },
    { id: 'tech-pg-id', slug: 'postgresql', name: 'PostgreSQL', category: 'Database' },
    { id: 'tech-redis-id', slug: 'redis', name: 'Redis', category: 'Database' },
    { id: 'tech-docker-id', slug: 'docker', name: 'Docker', category: 'DevOps' },
    { id: 'tech-k8s-id', slug: 'kubernetes', name: 'Kubernetes (K8s)', category: 'DevOps' },
    { id: 'tech-gql-id', slug: 'graphql', name: 'GraphQL', category: 'API' },
    { id: 'tech-torch-id', slug: 'pytorch', name: 'PyTorch', category: 'AI/Data' },
    { id: 'tech-pw-id', slug: 'playwright', name: 'Playwright', category: 'Testing' },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaxonomyMatcherService],
    }).compile();

    matcher = module.get<TaxonomyMatcherService>(TaxonomyMatcherService);
  });

  describe('Skill & Technology Matching', () => {
    it('matches common aliases (ReactJS, Postgres, Express, Docker-compose)', () => {
      const skills = ['ReactJS', 'Postgres', 'Express', 'docker-compose'];
      const result = matcher.matchSkillsToTechnologies(skills, mockTechnologies);

      expect(result.technologyIds).toContain('tech-react-id');
      expect(result.technologyIds).toContain('tech-pg-id');
      expect(result.technologyIds).toContain('tech-express-id');
      expect(result.technologyIds).toContain('tech-docker-id');
      expect(result.unmatchedSkills).toHaveLength(0);
    });

    it('matches expanded technology aliases (K8s, PyTorch, SpringBoot, FastAPI, Flutter, Playwright)', () => {
      const skills = ['k8s', 'torch', 'springboot', 'fastapi', 'flutter', 'playwright'];
      const result = matcher.matchSkillsToTechnologies(skills, mockTechnologies, 10);

      expect(result.technologyIds).toContain('tech-k8s-id');
      expect(result.technologyIds).toContain('tech-torch-id');
      expect(result.technologyIds).toContain('tech-spring-id');
      expect(result.technologyIds).toContain('tech-fastapi-id');
      expect(result.technologyIds).toContain('tech-flutter-id');
      expect(result.technologyIds).toContain('tech-pw-id');
    });

    it('handles fuzzy matching and slight typos in skill names', () => {
      const skills = ['Typescript', 'React.js', 'PostgreSql', 'Redis Cache'];
      const result = matcher.matchSkillsToTechnologies(skills, mockTechnologies);

      expect(result.technologyIds).toContain('tech-ts-id');
      expect(result.technologyIds).toContain('tech-react-id');
      expect(result.technologyIds).toContain('tech-pg-id');
      expect(result.technologyIds).toContain('tech-redis-id');
    });

    it('collects unknown skills not present in taxonomy DB', () => {
      const skills = ['React', 'Solidity', 'Rust', 'Ruby on Rails'];
      const result = matcher.matchSkillsToTechnologies(skills, mockTechnologies);

      expect(result.technologyIds).toEqual(['tech-react-id']);
      expect(result.unmatchedSkills).toEqual(['Solidity', 'Rust', 'Ruby on Rails']);
    });

    it('limits returned technology IDs to top 5 even when CV has >10 skills', () => {
      const skills = [
        'TypeScript',
        'React',
        'Node.js',
        'NestJS',
        'PostgreSQL',
        'Redis',
        'Docker',
        'GraphQL',
      ];
      const result = matcher.matchSkillsToTechnologies(skills, mockTechnologies, 5);

      expect(result.technologyIds.length).toBeLessThanOrEqual(5);
    });

    it('handles empty or null skills safely', () => {
      const result = matcher.matchSkillsToTechnologies([], mockTechnologies);
      expect(result.technologyIds).toEqual([]);
      expect(result.unmatchedSkills).toEqual([]);
    });
  });

  describe('Job Role Matching', () => {
    it('matches backend roles correctly', () => {
      const roleId = matcher.matchRoleToJobRole('Senior Backend Engineer', mockJobRoles);
      expect(roleId).toBe('role-be-id');
    });

    it('matches frontend roles correctly', () => {
      const roleId = matcher.matchRoleToJobRole('Frontend UI/UX Developer', mockJobRoles);
      expect(roleId).toBe('role-fe-id');
    });

    it('matches fullstack software engineer correctly', () => {
      const roleId = matcher.matchRoleToJobRole('Fullstack Software Engineer', mockJobRoles);
      expect(roleId).toBe('role-fs-id');
    });

    it('matches DevOps & Cloud roles correctly', () => {
      const roleId = matcher.matchRoleToJobRole('DevOps & Cloud Infrastructure', mockJobRoles);
      expect(roleId).toBe('role-devops-id');
    });

    it('matches Mobile App roles correctly', () => {
      expect(matcher.matchRoleToJobRole('Mobile App Developer (Flutter & iOS)', mockJobRoles)).toBe(
        'role-mobile-id',
      );
      expect(matcher.matchRoleToJobRole('React Native Developer', mockJobRoles)).toBe(
        'role-mobile-id',
      );
    });

    it('matches AI / ML roles correctly', () => {
      expect(
        matcher.matchRoleToJobRole('Machine Learning Specialist & AI Engineer', mockJobRoles),
      ).toBe('role-aiml-id');
      expect(matcher.matchRoleToJobRole('LLM & Deep Learning Researcher', mockJobRoles)).toBe(
        'role-aiml-id',
      );
    });

    it('matches Data Engineer and Data Scientist roles correctly', () => {
      expect(
        matcher.matchRoleToJobRole('Data Engineer (Big Data & ETL Pipelines)', mockJobRoles),
      ).toBe('role-de-id');
      expect(matcher.matchRoleToJobRole('Data Scientist / BI Analyst', mockJobRoles)).toBe(
        'role-ds-id',
      );
    });

    it('matches QA & Automation Test roles correctly', () => {
      expect(matcher.matchRoleToJobRole('Senior Automation QA Tester (SDET)', mockJobRoles)).toBe(
        'role-qa-id',
      );
    });

    it('matches Security Engineer roles correctly', () => {
      expect(matcher.matchRoleToJobRole('DevSecOps & Cybersecurity Engineer', mockJobRoles)).toBe(
        'role-sec-id',
      );
    });

    it('matches Cloud & Solutions Architect roles correctly', () => {
      expect(matcher.matchRoleToJobRole('Principal Cloud Solutions Architect', mockJobRoles)).toBe(
        'role-arch-id',
      );
    });

    it('matches Leadership & Embedded roles correctly', () => {
      expect(matcher.matchRoleToJobRole('Engineering Manager / Tech Lead', mockJobRoles)).toBe(
        'role-lead-id',
      );
      expect(matcher.matchRoleToJobRole('Embedded Firmware Engineer (IoT)', mockJobRoles)).toBe(
        'role-embedded-id',
      );
    });

    it('falls back gracefully to default role if input is undefined', () => {
      const roleId = matcher.matchRoleToJobRole(undefined, mockJobRoles);
      expect(roleId).toBe('role-fe-id');
    });
  });

  describe('Seniority Level Matching', () => {
    it('maps Fresher / Intern / Graduate to fresher level', () => {
      expect(matcher.matchSeniorityToLevel('FRESHER', mockLevels)).toBe('lvl-fr-id');
      expect(matcher.matchSeniorityToLevel('Fresher Developer', mockLevels)).toBe('lvl-fr-id');
      expect(matcher.matchSeniorityToLevel('Intern', mockLevels)).toBe('lvl-fr-id');
      expect(matcher.matchSeniorityToLevel('Fresh Graduate', mockLevels)).toBe('lvl-fr-id');
    });

    it('maps JUNIOR to junior level', () => {
      expect(matcher.matchSeniorityToLevel('JUNIOR', mockLevels)).toBe('lvl-jr-id');
      expect(matcher.matchSeniorityToLevel('Junior Software Engineer', mockLevels)).toBe(
        'lvl-jr-id',
      );
    });

    it('maps MID to mid-level', () => {
      expect(matcher.matchSeniorityToLevel('MID', mockLevels)).toBe('lvl-mid-id');
      expect(matcher.matchSeniorityToLevel('Middle Engineer', mockLevels)).toBe('lvl-mid-id');
    });

    it('maps SENIOR, LEAD, STAFF, PRINCIPAL to senior level', () => {
      expect(matcher.matchSeniorityToLevel('SENIOR', mockLevels)).toBe('lvl-sr-id');
      expect(matcher.matchSeniorityToLevel('Tech Lead', mockLevels)).toBe('lvl-sr-id');
      expect(matcher.matchSeniorityToLevel('Staff Software Engineer', mockLevels)).toBe(
        'lvl-sr-id',
      );
      expect(matcher.matchSeniorityToLevel('Principal Architect', mockLevels)).toBe('lvl-sr-id');
    });
  });

  describe('Combined matchCvProfile Orchestration', () => {
    it('orchestrates complete taxonomy match payload', () => {
      const profile = {
        targetRole: 'Senior Backend Developer',
        seniorityLevel: 'SENIOR',
        skills: ['Node.js', 'PostgreSQL', 'Docker', 'Redis', 'TypeScript', 'Kubernetes'],
      };

      const match = matcher.matchCvProfile(profile, mockJobRoles, mockLevels, mockTechnologies);

      expect(match.jobRoleId).toBe('role-be-id');
      expect(match.seniorityLevelId).toBe('lvl-sr-id');
      expect(match.technologyIds.length).toBeGreaterThanOrEqual(4);
      expect(match.suggestedMode).toBe(SessionMode.STANDARD);
    });
  });
});
