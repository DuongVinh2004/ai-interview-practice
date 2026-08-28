import { Injectable, Logger } from '@nestjs/common';
import { SessionMode, TaxonomyMatchResult } from '@ai-interview/contracts';

interface SimpleTaxonomyItem {
  id: string;
  slug: string;
  name: string;
  category?: string | null;
  order?: number;
}

@Injectable()
export class TaxonomyMatcherService {
  private readonly logger = new Logger(TaxonomyMatcherService.name);

  // Common aliases mapping compact normalized key -> standard technology slug
  private readonly TECH_ALIASES: Record<string, string> = {
    // Programming Languages
    js: 'javascript',
    javascript: 'javascript',
    es6: 'javascript',
    ecmascript: 'javascript',
    ts: 'typescript',
    typescript: 'typescript',
    python: 'python',
    python3: 'python',
    py: 'python',
    py3: 'python',
    java: 'java',
    openjdk: 'java',
    jdk: 'java',
    go: 'golang',
    golang: 'golang',
    csharp: 'csharp',
    'c#': 'csharp',
    dotnet: 'csharp',
    '.net': 'csharp',
    cplusplus: 'cpp',
    'c++': 'cpp',
    cpp: 'cpp',
    rust: 'rust',
    rustlang: 'rust',
    php: 'php',
    swift: 'swift',
    kotlin: 'kotlin',

    // Frontend Frameworks
    react: 'react',
    reactjs: 'react',
    next: 'nextjs',
    nextjs: 'nextjs',
    vue: 'vue',
    vuejs: 'vue',
    nuxt: 'vue',
    nuxtjs: 'vue',
    angular: 'angular',
    angularjs: 'angular',
    tailwind: 'tailwind-css',
    tailwindcss: 'tailwind-css',
    html: 'html5-css3',
    html5: 'html5-css3',
    css: 'html5-css3',
    css3: 'html5-css3',

    // Mobile Frameworks
    flutter: 'flutter',
    dart: 'flutter',
    reactnative: 'react-native',
    'react-native': 'react-native',
    rn: 'react-native',
    ios: 'ios-swift',
    android: 'android-kotlin',

    // Backend Frameworks
    node: 'nodejs',
    nodejs: 'nodejs',
    nest: 'nestjs',
    nestjs: 'nestjs',
    express: 'expressjs',
    expressjs: 'expressjs',
    spring: 'spring-boot',
    springboot: 'spring-boot',
    'spring-boot': 'spring-boot',
    django: 'django',
    fastapi: 'fastapi',
    aspnet: 'aspnet-core',
    aspnetcore: 'aspnet-core',
    'aspnet-core': 'aspnet-core',
    dotnetcore: 'aspnet-core',
    gin: 'gin-gorm',
    gorm: 'gin-gorm',
    'gin-gorm': 'gin-gorm',
    laravel: 'laravel',

    // Databases & Caching
    postgres: 'postgresql',
    postgresql: 'postgresql',
    pgsql: 'postgresql',
    psql: 'postgresql',
    mysql: 'mysql',
    mariadb: 'mysql',
    mongo: 'mongodb',
    mongodb: 'mongodb',
    redis: 'redis',
    rediscache: 'redis',
    elasticsearch: 'elasticsearch',
    elastic: 'elasticsearch',
    es: 'elasticsearch',
    cassandra: 'cassandra',
    dynamo: 'dynamodb',
    dynamodb: 'dynamodb',

    // API & Messaging
    graphql: 'graphql',
    gql: 'graphql',
    grpc: 'grpc',
    protobuf: 'grpc',
    rest: 'rest-api',
    restful: 'rest-api',
    restapi: 'rest-api',
    'rest-api': 'rest-api',
    kafka: 'kafka',
    apachekafka: 'kafka',
    rabbitmq: 'rabbitmq',
    rabbit: 'rabbitmq',
    websocket: 'websocket',
    websockets: 'websocket',
    socketio: 'websocket',
    ws: 'websocket',

    // Cloud & DevOps
    docker: 'docker',
    dockercompose: 'docker',
    container: 'docker',
    containers: 'docker',
    k8s: 'kubernetes',
    kubernetes: 'kubernetes',
    aws: 'aws',
    amazonwebservices: 'aws',
    gcp: 'gcp',
    googlecloud: 'gcp',
    azure: 'azure',
    msazure: 'azure',
    terraform: 'terraform',
    tf: 'terraform',
    cicd: 'cicd-github-actions',
    githubactions: 'cicd-github-actions',
    gitlabci: 'cicd-github-actions',
    jenkins: 'cicd-github-actions',
    linux: 'linux-systems',
    bash: 'linux-systems',
    shell: 'linux-systems',

    // AI & Big Data
    pytorch: 'pytorch',
    torch: 'pytorch',
    tensorflow: 'tensorflow',
    keras: 'tensorflow',
    langchain: 'langchain-rag',
    rag: 'langchain-rag',
    pandas: 'pandas-numpy',
    numpy: 'pandas-numpy',
    spark: 'spark',
    pyspark: 'spark',

    // Testing & Security
    playwright: 'playwright',
    pw: 'playwright',
    cypress: 'cypress',
    selenium: 'selenium',
    jest: 'jest-vitest',
    vitest: 'jest-vitest',
    owasp: 'owasp-security',
    appsec: 'owasp-security',
    pentest: 'owasp-security',
    jmeter: 'jmeter-k6',
    k6: 'jmeter-k6',
    locust: 'jmeter-k6',
  };

  /**
   * Normalizes a string for matching: lowercase, alphanumeric compact representation
   */
  private compactNormalize(str: string): string {
    return (str || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9+#]/g, '');
  }

  /**
   * Normalizes a string for phrase comparisons (single spaces, trimmed)
   */
  private normalize(str: string): string {
    return (str || '')
      .toLowerCase()
      .trim()
      .replace(/[\s\-_.]+/g, ' ');
  }

  /**
   * Computes Levenshtein distance between two strings
   */
  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    const aLen = a.length;
    const bLen = b.length;

    if (aLen === 0) return bLen;
    if (bLen === 0) return aLen;

    for (let i = 0; i <= bLen; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= aLen; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= bLen; i++) {
      for (let j = 1; j <= aLen; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1, // deletion
          );
        }
      }
    }

    return matrix[bLen][aLen];
  }

  /**
   * Computes similarity ratio between 0.0 and 1.0 using compact string matching, token containment & Levenshtein
   */
  private computeSimilarity(s1: string, s2: string): number {
    const norm1 = this.normalize(s1);
    const norm2 = this.normalize(s2);

    if (norm1 === norm2) return 1.0;
    if (!norm1 || !norm2) return 0.0;

    const compact1 = this.compactNormalize(s1);
    const compact2 = this.compactNormalize(s2);

    if (compact1 === compact2) return 1.0;

    // Check token-based containment
    const tokens1 = norm1.split(' ');
    const tokens2 = norm2.split(' ');
    if (tokens1.includes(norm2) || tokens2.includes(norm1)) {
      return 0.95;
    }
    if (tokens1.some(t => t === compact2) || tokens2.some(t => t === compact1)) {
      return 0.95;
    }

    // Direct containment
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const minLen = Math.min(norm1.length, norm2.length);
      const maxLen = Math.max(norm1.length, norm2.length);
      if (minLen / maxLen >= 0.4) {
        return Math.max(0.85, minLen / maxLen);
      }
    }

    const dist = this.levenshtein(compact1, compact2);
    const maxLen = Math.max(compact1.length, compact2.length);
    return maxLen > 0 ? 1 - dist / maxLen : 0;
  }

  /**
   * Matches candidate skills against registered active taxonomy technologies
   * Returns top matching technology IDs (up to maxCount, default 5) and any unmatched skills
   */
  matchSkillsToTechnologies(
    skills: string[],
    technologies: SimpleTaxonomyItem[],
    maxCount = 5,
  ): {
    technologyIds: string[];
    unmatchedSkills: string[];
  } {
    if (!skills || skills.length === 0 || !technologies || technologies.length === 0) {
      return { technologyIds: [], unmatchedSkills: skills || [] };
    }

    const matchedTechIds = new Set<string>();
    const matchedSkillIndices = new Set<number>();

    // 1. First pass: Exact match & Alias mapping
    skills.forEach((skill, index) => {
      const normSkill = this.normalize(skill);
      const compactSkill = this.compactNormalize(skill);
      const aliasTarget =
        this.TECH_ALIASES[compactSkill] || this.TECH_ALIASES[normSkill] || compactSkill;

      for (const tech of technologies) {
        const normTechName = this.normalize(tech.name);
        const normTechSlug = this.normalize(tech.slug);
        const compactTechName = this.compactNormalize(tech.name);
        const compactTechSlug = this.compactNormalize(tech.slug);

        if (
          normSkill === normTechName ||
          normSkill === normTechSlug ||
          compactSkill === compactTechName ||
          compactSkill === compactTechSlug ||
          aliasTarget === compactTechSlug ||
          aliasTarget === compactTechName
        ) {
          matchedTechIds.add(tech.id);
          matchedSkillIndices.add(index);
          break;
        }
      }
    });

    // 2. Second pass: Fuzzy string matching & token similarity for remaining unmatched skills
    const SIMILARITY_THRESHOLD = 0.75;
    skills.forEach((skill, index) => {
      if (matchedSkillIndices.has(index)) return;

      let bestScore = 0;
      let bestTech: SimpleTaxonomyItem | null = null;

      for (const tech of technologies) {
        const nameScore = this.computeSimilarity(skill, tech.name);
        const slugScore = this.computeSimilarity(skill, tech.slug);
        const score = Math.max(nameScore, slugScore);

        if (score > bestScore && score >= SIMILARITY_THRESHOLD) {
          bestScore = score;
          bestTech = tech;
        }
      }

      if (bestTech) {
        matchedTechIds.add(bestTech.id);
        matchedSkillIndices.add(index);
      }
    });

    const unmatchedSkills = skills.filter((_, index) => !matchedSkillIndices.has(index));
    const technologyIds = Array.from(matchedTechIds).slice(0, maxCount);

    return {
      technologyIds,
      unmatchedSkills,
    };
  }

  /**
   * Matches candidate target role against registered job roles
   */
  matchRoleToJobRole(
    targetRole: string | null | undefined,
    jobRoles: SimpleTaxonomyItem[],
  ): string | null {
    if (!targetRole || !jobRoles || jobRoles.length === 0) {
      return jobRoles?.[0]?.id || null;
    }

    const normRole = this.normalize(targetRole);

    // 1. Keyword check for canonical roles (specific to general)
    if (
      normRole.includes('mobile') ||
      normRole.includes('ios') ||
      normRole.includes('android') ||
      normRole.includes('flutter') ||
      normRole.includes('react native')
    ) {
      const match = jobRoles.find(r => r.slug === 'mobile-engineer');
      if (match) return match.id;
    }

    if (
      normRole.includes('ai') ||
      normRole.includes('machine learning') ||
      normRole.includes('deep learning') ||
      normRole.includes('ml engineer') ||
      normRole.includes('llm') ||
      normRole.includes('nlp') ||
      normRole.includes('computer vision')
    ) {
      const match = jobRoles.find(r => r.slug === 'ai-ml-engineer');
      if (match) return match.id;
    }

    if (
      normRole.includes('data engineer') ||
      normRole.includes('big data') ||
      normRole.includes('data pipeline') ||
      normRole.includes('etl')
    ) {
      const match = jobRoles.find(r => r.slug === 'data-engineer');
      if (match) return match.id;
    }

    if (
      normRole.includes('data analyst') ||
      normRole.includes('data scientist') ||
      normRole.includes('business intelligence') ||
      normRole.includes('bi analyst')
    ) {
      const match = jobRoles.find(r => r.slug === 'data-analyst-scientist');
      if (match) return match.id;
    }

    if (
      normRole.includes('security') ||
      normRole.includes('cyber') ||
      normRole.includes('devsecops') ||
      normRole.includes('infosec') ||
      normRole.includes('appsec') ||
      normRole.includes('soc')
    ) {
      const match = jobRoles.find(r => r.slug === 'security-engineer');
      if (match) return match.id;
    }

    if (
      normRole.includes('qa') ||
      normRole.includes('qc') ||
      normRole.includes('tester') ||
      normRole.includes('test engineer') ||
      normRole.includes('automation test') ||
      normRole.includes('quality assurance') ||
      normRole.includes('sdet')
    ) {
      const match = jobRoles.find(
        r => r.slug === 'qa-qc-automation-engineer' || r.slug === 'qa-engineer',
      );
      if (match) return match.id;
    }

    if (
      normRole.includes('solutions architect') ||
      normRole.includes('cloud architect') ||
      normRole.includes('system architect') ||
      normRole.includes('enterprise architect') ||
      normRole.includes('software architect')
    ) {
      const match = jobRoles.find(r => r.slug === 'cloud-solutions-architect');
      if (match) return match.id;
    }

    if (
      normRole.includes('tech lead') ||
      normRole.includes('team lead') ||
      normRole.includes('engineering manager') ||
      normRole.includes('engineering lead') ||
      normRole.includes('technical lead')
    ) {
      const match = jobRoles.find(r => r.slug === 'engineering-manager-tech-lead');
      if (match) return match.id;
    }

    if (
      normRole.includes('embedded') ||
      normRole.includes('firmware') ||
      normRole.includes('iot') ||
      normRole.includes('microcontroller')
    ) {
      const match = jobRoles.find(r => r.slug === 'embedded-iot-engineer');
      if (match) return match.id;
    }

    if (
      normRole.includes('devops') ||
      normRole.includes('dev ops') ||
      normRole.includes('sre') ||
      normRole.includes('infra') ||
      normRole.includes('cloud') ||
      normRole.includes('platform engineer')
    ) {
      const match = jobRoles.find(r => r.slug === 'devops-engineer');
      if (match) return match.id;
    }

    if (
      normRole.includes('frontend') ||
      normRole.includes('front end') ||
      normRole.includes('ui')
    ) {
      const match = jobRoles.find(r => r.slug === 'frontend-engineer');
      if (match) return match.id;
    }

    if (
      normRole.includes('backend') ||
      normRole.includes('back end') ||
      normRole.includes('server') ||
      normRole.includes('api')
    ) {
      const match = jobRoles.find(r => r.slug === 'backend-engineer');
      if (match) return match.id;
    }

    if (
      normRole.includes('fullstack') ||
      normRole.includes('full stack') ||
      normRole.includes('software engineer')
    ) {
      const match = jobRoles.find(r => r.slug === 'fullstack-engineer');
      if (match) return match.id;
    }

    // 2. Fuzzy match against job role names
    let bestScore = 0;
    let bestRole: SimpleTaxonomyItem | null = null;
    for (const role of jobRoles) {
      const score = Math.max(
        this.computeSimilarity(targetRole, role.name),
        this.computeSimilarity(targetRole, role.slug),
      );
      if (score > bestScore) {
        bestScore = score;
        bestRole = role;
      }
    }

    if (bestRole && bestScore >= 0.5) {
      return bestRole.id;
    }

    return jobRoles[0]?.id || null;
  }

  /**
   * Matches candidate seniority against registered seniority levels
   */
  matchSeniorityToLevel(
    seniorityLevel: string | null | undefined,
    levels: SimpleTaxonomyItem[],
  ): string | null {
    if (!levels || levels.length === 0) return null;
    if (!seniorityLevel) return levels.find(l => l.slug === 'mid-level')?.id || levels[0].id;

    const normLevel = this.normalize(seniorityLevel);

    if (
      normLevel.includes('fresher') ||
      normLevel.includes('intern') ||
      normLevel.includes('entry') ||
      normLevel.includes('graduate')
    ) {
      const fresherMatch = levels.find(l => l.slug === 'fresher');
      if (fresherMatch) return fresherMatch.id;
      const juniorMatch = levels.find(l => l.slug === 'junior');
      if (juniorMatch) return juniorMatch.id;
    }

    if (normLevel.includes('junior')) {
      const match = levels.find(l => l.slug === 'junior');
      if (match) return match.id;
    }

    if (
      normLevel.includes('senior') ||
      normLevel.includes('lead') ||
      normLevel.includes('staff') ||
      normLevel.includes('principal') ||
      normLevel.includes('architect')
    ) {
      const match = levels.find(l => l.slug === 'senior');
      if (match) return match.id;
    }

    // Default or Mid-Level
    const midMatch = levels.find(l => l.slug === 'mid-level');
    return midMatch ? midMatch.id : levels[0].id;
  }

  /**
   * Suggests interview session mode based on profile seniority & skills
   */
  suggestSessionMode(seniorityLevel?: string | null): SessionMode {
    const norm = (seniorityLevel || '').toUpperCase();
    if (norm.includes('SENIOR') || norm.includes('LEAD') || norm.includes('STAFF')) {
      return SessionMode.STANDARD;
    }
    return SessionMode.STANDARD;
  }

  /**
   * Combined orchestration method: maps parsed profile into complete TaxonomyMatchResult
   */
  matchCvProfile(
    profile: {
      targetRole?: string | null;
      seniorityLevel?: string | null;
      skills?: string[];
    },
    jobRoles: SimpleTaxonomyItem[],
    levels: SimpleTaxonomyItem[],
    technologies: SimpleTaxonomyItem[],
  ): TaxonomyMatchResult {
    const jobRoleId = this.matchRoleToJobRole(profile.targetRole, jobRoles);
    const seniorityLevelId = this.matchSeniorityToLevel(profile.seniorityLevel, levels);
    const { technologyIds, unmatchedSkills } = this.matchSkillsToTechnologies(
      profile.skills || [],
      technologies,
      5,
    );
    const suggestedMode = this.suggestSessionMode(profile.seniorityLevel);

    return {
      jobRoleId,
      seniorityLevelId,
      technologyIds,
      suggestedMode,
      unmatchedSkills,
    };
  }
}
