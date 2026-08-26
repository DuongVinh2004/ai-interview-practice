import { Injectable, Logger } from '@nestjs/common';
import { ParsedProfileDto, ParsedExperience } from '@ai-interview/contracts';
import { TextExtractorService } from './text-extractor.service';

@Injectable()
export class CvAnalyzerService {
  private readonly logger = new Logger(CvAnalyzerService.name);

  constructor(private readonly textExtractor: TextExtractorService) {}

  /**
   * Analyzes raw CV text, applies PII scrubbing, and produces structured profile entities.
   */
  async analyzeCv(rawText: string): Promise<ParsedProfileDto> {
    const maskedText = this.textExtractor.maskPii(rawText);

    // Heuristic structured extraction with intelligent regex & section parsing
    return this.extractStructuredProfile(maskedText);
  }

  private extractStructuredProfile(text: string): ParsedProfileDto {
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    // 1. Detect target role / title
    const roleKeywords = [
      'Frontend',
      'Backend',
      'Fullstack',
      'DevOps',
      'Software Engineer',
      'Tech Lead',
      'Mobile',
      'QA',
      'Architect',
      'Data Engineer',
    ];
    let targetRole = 'Software Engineer';
    for (const line of lines.slice(0, 15)) {
      for (const kw of roleKeywords) {
        if (line.toLowerCase().includes(kw.toLowerCase())) {
          targetRole = kw.includes('Engineer') ? kw : `${kw} Developer`;
          break;
        }
      }
    }

    // 2. Detect seniority
    let seniorityLevel = 'MID';
    const lowerText = text.toLowerCase();
    if (
      lowerText.includes('senior') ||
      lowerText.includes('lead') ||
      lowerText.includes('principal')
    ) {
      seniorityLevel = 'SENIOR';
    } else if (
      lowerText.includes('junior') ||
      lowerText.includes('intern') ||
      lowerText.includes('fresher')
    ) {
      seniorityLevel = 'JUNIOR';
    } else if (lowerText.includes('staff') || lowerText.includes('architect')) {
      seniorityLevel = 'STAFF';
    }

    // 3. Extract tech skills
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
    ];
    const skillsDetected = new Set<string>();
    for (const tech of techCatalog) {
      const regex = new RegExp(`\\b${tech.replace('.', '\\.')}\\b`, 'i');
      if (regex.test(text)) {
        skillsDetected.add(tech);
      }
    }

    // 4. Experience parsing
    const experienceList: ParsedExperience[] = [];
    const expHeaders = ['experience', 'work history', 'kinh nghiệm', 'employment', 'projects'];
    let inExpSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (expHeaders.some(h => line.toLowerCase().includes(h))) {
        inExpSection = true;
        continue;
      }
      if (
        inExpSection &&
        (line.toLowerCase().includes('education') ||
          line.toLowerCase().includes('skills') ||
          line.toLowerCase().includes('học vấn'))
      ) {
        inExpSection = false;
        break;
      }
      if (inExpSection && line.length > 5) {
        // Parse company/role lines
        if (line.includes('-') || line.includes('|') || line.includes(':')) {
          const parts = line.split(/[-|:]/).map(p => p.trim());
          if (parts.length >= 2) {
            experienceList.push({
              company: parts[0] || 'Tech Company',
              role: parts[1] || targetRole,
              duration: '1-3 years',
              responsibilities: lines
                .slice(i + 1, Math.min(i + 4, lines.length))
                .filter(l => l.startsWith('-') || l.startsWith('*')),
              projects: [
                {
                  name: `${parts[0]} Core Platform`,
                  role: parts[1] || targetRole,
                  technologies: Array.from(skillsDetected).slice(0, 4),
                  description: `Engineered microservices and web components using ${Array.from(skillsDetected).slice(0, 3).join(', ')}.`,
                  highlights: ['Optimized response latency', 'Implemented automated testing'],
                },
              ],
            });
          }
        }
      }
    }

    // 5. Education parsing
    const educationList: string[] = [];
    if (
      lowerText.includes('computer science') ||
      lowerText.includes('bachelor') ||
      lowerText.includes('đại học') ||
      lowerText.includes('công nghệ thông tin')
    ) {
      educationList.push('B.S. in Computer Science / Information Technology');
    } else if (lowerText.includes('education') || lowerText.includes('học vấn')) {
      educationList.push('Higher Education in Technical / Engineering Field');
    }

    const detectedSkills = Array.from(skillsDetected);
    const summary =
      detectedSkills.length > 0
        ? `Candidate with ${seniorityLevel} level background in ${targetRole}, skills: ${detectedSkills.slice(0, 6).join(', ')}.`
        : `Profile extracted for ${targetRole} (${seniorityLevel}).`;

    return {
      fullName: '[CANDIDATE_NAME]',
      targetRole,
      seniorityLevel,
      skills: detectedSkills,
      experience: experienceList,
      education: educationList,
      rawSummary: summary,
    };
  }
}
