import { Test, TestingModule } from '@nestjs/testing';
import { DocumentParserService } from './document-parser.service';
import { TextExtractorService } from './services/text-extractor.service';
import { CvAnalyzerService } from './services/cv-analyzer.service';
import { JdAnalyzerService } from './services/jd-analyzer.service';
import { BlueprintGeneratorService } from './services/blueprint-generator.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('DocumentParser Module (F004)', () => {
  let parserService: DocumentParserService;
  let textExtractor: TextExtractorService;
  let cvAnalyzer: CvAnalyzerService;
  let jdAnalyzer: JdAnalyzerService;
  let blueprintGen: BlueprintGeneratorService;

  const mockPrisma = {
    userDocument: {
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => Promise.resolve({ id: 'doc-uuid-1', ...data })),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn().mockResolvedValue({ id: 'doc-uuid-1' }),
    },
    parsedProfile: {
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => Promise.resolve({ id: 'profile-uuid-1', ...data })),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    jdAnalysis: {
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => Promise.resolve({ id: 'jd-uuid-1', ...data })),
      findUnique: jest.fn(),
    },
    interviewBlueprint: {
      create: jest
        .fn()
        .mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'blueprint-uuid-1', ...data }),
        ),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentParserService,
        TextExtractorService,
        CvAnalyzerService,
        JdAnalyzerService,
        BlueprintGeneratorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    parserService = module.get<DocumentParserService>(DocumentParserService);
    textExtractor = module.get<TextExtractorService>(TextExtractorService);
    cvAnalyzer = module.get<CvAnalyzerService>(CvAnalyzerService);
    jdAnalyzer = module.get<JdAnalyzerService>(JdAnalyzerService);
    blueprintGen = module.get<BlueprintGeneratorService>(BlueprintGeneratorService);
  });

  describe('TextExtractorService & PII Masking', () => {
    it('masks phone numbers, emails, and physical addresses from raw text', () => {
      const rawCv = `
        John Doe
        Email: candidate.john@example.com
        Phone: +84 912 345 678
        Address: 123 Nguyen Hue Boulevard, District 1, TP HCM
        Summary: Experienced Senior Backend Engineer with Node.js and PostgreSQL.
      `;

      const masked = textExtractor.maskPii(rawCv);
      expect(masked).not.toContain('candidate.john@example.com');
      expect(masked).not.toContain('+84 912 345 678');
      expect(masked).toContain('[EMAIL_MASKED]');
      expect(masked).toContain('[PHONE_MASKED]');
      expect(masked).toContain('[ADDRESS_MASKED]');
      expect(masked).toContain('Senior Backend Engineer');
    });

    it('rejects files larger than 5MB', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
      await expect(textExtractor.extractText(largeBuffer, 'pdf', 'heavy.pdf')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('CvAnalyzerService & JdAnalyzerService', () => {
    it('extracts skills, seniority, and experience from CV text', async () => {
      const cvText = `
        Senior Fullstack Engineer
        Skills: TypeScript, React, Node.js, PostgreSQL, Docker, Redis
        Experience:
        ABC Tech - Senior Developer
        - Built distributed payment microservices with Node.js and Redis
        - Optimized database queries in PostgreSQL
      `;

      const profile = await cvAnalyzer.analyzeCv(cvText);
      expect(profile.seniorityLevel).toBe('SENIOR');
      expect(profile.skills).toContain('TypeScript');
      expect(profile.skills).toContain('Node.js');
      expect(profile.skills).toContain('PostgreSQL');
      expect(profile.experience.length).toBeGreaterThan(0);
    });

    it('extracts required skills, seniority, and responsibilities from JD text', async () => {
      const jdText = `
        Job Title: Senior Backend Engineer
        Requirements:
        - 3+ years experience with Go, Kubernetes, Kafka, and PostgreSQL
        - Strong knowledge of System Design and Microservices
        Responsibilities:
        - Design and develop high-throughput messaging pipelines
        - Maintain CI/CD pipelines and deployment automation
      `;

      const jd = await jdAnalyzer.analyzeJd(jdText);
      expect(jd.roleTitle).toContain('Backend');
      expect(jd.seniorityLevel).toBe('SENIOR');
      expect(jd.requiredSkills.length).toBeGreaterThan(0);
      expect(jd.responsibilities.length).toBeGreaterThan(0);
    });
  });

  describe('BlueprintGeneratorService', () => {
    it('computes skill overlap, gap areas, and topic weights summing to 100%', () => {
      const profile = {
        skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker'],
        experience: [
          {
            company: 'Alpha Corp',
            role: 'Senior Developer',
            projects: [
              {
                name: 'E-commerce API',
                technologies: ['Node.js', 'PostgreSQL'],
                highlights: ['10k RPS'],
              },
            ],
          },
        ],
      };

      const jd = {
        roleTitle: 'Senior Backend Engineer',
        seniorityLevel: 'SENIOR',
        requiredSkills: ['Node.js', 'PostgreSQL', 'Kafka', 'Kubernetes'],
        preferredSkills: ['Redis', 'GraphQL'],
        responsibilities: ['Build high-scale systems'],
      };

      const blueprint = blueprintGen.generateBlueprint('prof-1', 'jd-1', profile as any, jd as any);

      expect(blueprint.matchedSkills).toContain('Node.js');
      expect(blueprint.matchedSkills).toContain('PostgreSQL');
      expect(blueprint.gapSkills).toContain('Kafka');
      expect(blueprint.gapSkills).toContain('Kubernetes');
      expect(blueprint.matchPercentage).toBe(50); // 2 out of 4 required matched

      const totalWeight = blueprint.topics.reduce((sum, t) => sum + t.weight, 0);
      expect(totalWeight).toBe(100);
      expect(blueprint.topics.length).toBe(3);
    });
  });

  describe('DocumentParserService E2E flow', () => {
    it('executes full parsing, analysis, and blueprint generation lifecycle', async () => {
      // 1. Parse CV
      const cvResult = await parserService.parseCv('user-1', {
        fileName: 'resume.txt',
        fileType: 'text',
        rawText: 'Senior Backend Developer with 5 years in TypeScript, Node.js, and PostgreSQL.',
      });
      expect(cvResult.document.id).toBe('doc-uuid-1');
      expect(cvResult.parsedProfile.id).toBe('profile-uuid-1');

      // 2. Analyze JD
      const jdResult = await parserService.analyzeJd('user-1', {
        jdText:
          'Looking for a Senior Backend Developer proficient in Node.js, PostgreSQL, Kafka, and Docker.',
      });
      expect(jdResult.id).toBe('jd-uuid-1');

      // Mock database lookups for blueprint generation
      mockPrisma.parsedProfile.findUnique.mockResolvedValueOnce({
        id: 'profile-uuid-1',
        documentId: 'doc-uuid-1',
        skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
        experience: [{ company: 'Test Org', role: 'Senior Developer', projects: [] }],
        document: { userId: 'user-1' },
      });

      mockPrisma.jdAnalysis.findUnique.mockResolvedValueOnce({
        id: 'jd-uuid-1',
        userId: 'user-1',
        roleTitle: 'Senior Backend Developer',
        seniorityLevel: 'SENIOR',
        requiredSkills: ['Node.js', 'PostgreSQL', 'Kafka'],
        preferredSkills: ['Docker'],
        responsibilities: ['Build scalable APIs'],
      });

      // 3. Generate Blueprint
      const blueprint = await parserService.generateBlueprint('user-1', {
        parsedProfileId: 'profile-uuid-1',
        jdAnalysisId: 'jd-uuid-1',
      });
      expect(blueprint.id).toBe('blueprint-uuid-1');
      expect(blueprint.gapSkills).toContain('Kafka');
    });

    it('retrieves blueprint when requested by the resource owner', async () => {
      mockPrisma.interviewBlueprint.findUnique.mockResolvedValueOnce({
        id: 'bp-123',
        parsedProfile: {
          document: { userId: 'user-1' },
        },
        jdAnalysis: { userId: 'user-1' },
      });

      const res = await parserService.getBlueprint('user-1', 'bp-123');
      expect(res.id).toBe('bp-123');
    });

    it('rejects cross-user blueprint retrieval (IDOR prevention)', async () => {
      mockPrisma.interviewBlueprint.findUnique.mockResolvedValueOnce({
        id: 'bp-victim',
        parsedProfile: {
          document: { userId: 'victim-user' },
        },
        jdAnalysis: { userId: 'victim-user' },
      });

      await expect(parserService.getBlueprint('attacker-user', 'bp-victim')).rejects.toThrow(
        'You do not have access to this interview blueprint.',
      );
    });

    it('rejects fake PDF upload with invalid magic bytes', async () => {
      const corruptPdfBuffer = Buffer.from('NOT_A_REAL_PDF_DATA_STREAM');
      await expect(
        textExtractor.extractText(corruptPdfBuffer, 'pdf', 'malicious.pdf'),
      ).rejects.toThrow('Invalid PDF file header. Missing %PDF signature.');
    });

    it('rejects fake DOCX upload with invalid magic bytes', async () => {
      const corruptDocxBuffer = Buffer.from('NOT_A_REAL_DOCX_FILE_HEADER');
      await expect(
        textExtractor.extractText(corruptDocxBuffer, 'docx', 'malicious.docx'),
      ).rejects.toThrow('Invalid DOCX file header. Missing ZIP/DOCX signature.');
    });
  });
});
