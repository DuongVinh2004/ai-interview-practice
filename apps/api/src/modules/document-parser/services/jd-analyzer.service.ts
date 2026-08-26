import { Injectable, Logger } from '@nestjs/common';
import { JdAnalysisDto } from '@ai-interview/contracts';

@Injectable()
export class JdAnalyzerService {
  private readonly logger = new Logger(JdAnalyzerService.name);

  /**
   * Analyzes job description text to extract requirements, skills, responsibilities, and seniority.
   */
  async analyzeJd(jdText: string, suggestedTitle?: string): Promise<JdAnalysisDto> {
    const lowerText = jdText.toLowerCase();

    // 1. Detect role title
    let roleTitle = suggestedTitle || 'Senior Software Engineer';
    const roleKeywords = [
      'Backend Engineer',
      'Frontend Engineer',
      'Fullstack Engineer',
      'DevOps Engineer',
      'System Architect',
      'Data Engineer',
      'QA Automation Engineer',
      'Mobile Engineer',
      'Tech Lead',
    ];
    for (const kw of roleKeywords) {
      if (lowerText.includes(kw.toLowerCase())) {
        roleTitle = kw;
        break;
      }
    }

    // 2. Detect seniority
    let seniorityLevel = 'SENIOR';
    if (
      lowerText.includes('junior') ||
      lowerText.includes('entry level') ||
      lowerText.includes('fresher')
    ) {
      seniorityLevel = 'JUNIOR';
    } else if (
      lowerText.includes('mid') ||
      lowerText.includes('middle') ||
      lowerText.includes('2-3 years') ||
      lowerText.includes('2+ years')
    ) {
      seniorityLevel = 'MID';
    } else if (
      lowerText.includes('lead') ||
      lowerText.includes('principal') ||
      lowerText.includes('staff')
    ) {
      seniorityLevel = 'LEAD';
    }

    // 3. Extract required and preferred skills
    const techCatalog = [
      'JavaScript',
      'TypeScript',
      'Node.js',
      'React',
      'Vue',
      'Angular',
      'Next.js',
      'NestJS',
      'Express',
      'Python',
      'Django',
      'FastAPI',
      'Go',
      'Golang',
      'Java',
      'Spring Boot',
      'C#',
      '.NET',
      'PostgreSQL',
      'MySQL',
      'MongoDB',
      'Redis',
      'Kafka',
      'RabbitMQ',
      'Elasticsearch',
      'Docker',
      'Kubernetes',
      'AWS',
      'GCP',
      'Azure',
      'Terraform',
      'CI/CD',
      'Git',
      'GraphQL',
      'REST',
      'System Design',
      'Microservices',
      'Clean Architecture',
      'Unit Testing',
      'High Availability',
    ];

    const detectedTech: string[] = [];
    for (const tech of techCatalog) {
      const regex = new RegExp(`\\b${tech.replace('.', '\\.')}\\b`, 'i');
      if (regex.test(jdText)) {
        detectedTech.push(tech);
      }
    }

    const requiredSkills = detectedTech.slice(0, Math.min(5, detectedTech.length));
    const preferredSkills = detectedTech.slice(Math.min(5, detectedTech.length));

    if (requiredSkills.length === 0) {
      requiredSkills.push('TypeScript', 'Node.js', 'PostgreSQL', 'Docker');
      preferredSkills.push('Redis', 'Kafka', 'Kubernetes');
    }

    // 4. Extract responsibilities
    const responsibilities: string[] = [];
    const lines = jdText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      if (
        (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) &&
        (line.toLowerCase().includes('design') ||
          line.toLowerCase().includes('build') ||
          line.toLowerCase().includes('develop') ||
          line.toLowerCase().includes('lead') ||
          line.toLowerCase().includes('maintain') ||
          line.toLowerCase().includes('xây dựng') ||
          line.toLowerCase().includes('phát triển'))
      ) {
        responsibilities.push(line.replace(/^[-•*]\s*/, ''));
      }
    }

    if (responsibilities.length === 0) {
      responsibilities.push(
        `Design and implement scalable backend microservices and REST/GraphQL APIs`,
        `Collaborate with cross-functional product and infrastructure teams`,
        `Optimize system latency, database queries, and distributed caching mechanisms`,
        `Participate in code reviews, architectural discussions, and technical mentoring`,
      );
    }

    const companyContext = `Position for ${roleTitle} (${seniorityLevel}) focusing on high-scale systems, engineering excellence, and modern cloud architectures.`;

    return {
      roleTitle,
      requiredSkills,
      preferredSkills,
      responsibilities: responsibilities.slice(0, 6),
      seniorityLevel,
      companyContext,
      rawJdText: jdText,
    };
  }
}
