import { Test, TestingModule } from '@nestjs/testing';
import { DocumentParserService } from '../document-parser.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { TextExtractorService } from '../services/text-extractor.service';
import { CvAnalyzerService } from '../services/cv-analyzer.service';
import { JdAnalyzerService } from '../services/jd-analyzer.service';
import { BlueprintGeneratorService } from '../services/blueprint-generator.service';

describe('Document Parser PII Scrubbing (P2-003)', () => {
  let documentParserService: DocumentParserService;

  const mockPrisma = {
    userDocument: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    parsedProfile: {
      create: jest.fn(),
    },
  };

  const mockTextExtractor = { extractText: jest.fn() };
  const mockCvAnalyzer = {
    analyzeCv: jest.fn().mockResolvedValue({
      fullName: 'John Doe',
      targetRole: 'Software Engineer',
      seniorityLevel: 'MID',
      skills: ['TypeScript', 'Node.js'],
      experience: [],
      education: [],
      rawSummary: 'Experienced developer',
    }),
  };
  const mockJdAnalyzer = { analyzeJd: jest.fn() };
  const mockBlueprintGenerator = { generateBlueprint: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentParserService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TextExtractorService, useValue: mockTextExtractor },
        { provide: CvAnalyzerService, useValue: mockCvAnalyzer },
        { provide: JdAnalyzerService, useValue: mockJdAnalyzer },
        { provide: BlueprintGeneratorService, useValue: mockBlueprintGenerator },
      ],
    }).compile();

    documentParserService = module.get<DocumentParserService>(DocumentParserService);
    jest.clearAllMocks();
  });

  it('redacts email, phone numbers, and SSNs from rawText before saving to database', async () => {
    const rawResumeText = `
      John Doe
      Email: candidate.personal@gmail.com
      Phone: +1 (555) 234-5678 or 098-765-4321
      SSN: 123-45-6789
      Skills: TypeScript, PostgreSQL, NestJS, Docker
    `;

    mockPrisma.userDocument.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'doc-123', ...data }),
    );
    mockPrisma.parsedProfile.create.mockResolvedValue({ id: 'prof-123' });

    const result = await documentParserService.parseCv('user-123', {
      fileName: 'resume.txt',
      fileType: 'text',
      rawText: rawResumeText,
    });

    // Check database call arguments
    const savedData = mockPrisma.userDocument.create.mock.calls[0][0].data;
    expect(savedData.rawText).not.toContain('candidate.personal@gmail.com');
    expect(savedData.rawText).toContain('[EMAIL_REDACTED]');
    expect(savedData.rawText).not.toContain('+1 (555) 234-5678');
    expect(savedData.rawText).toContain('[PHONE_REDACTED]');
    expect(savedData.rawText).not.toContain('123-45-6789');
    expect(savedData.rawText).toContain('[ID_REDACTED]');

    // Check returned document object excludes rawText
    expect(result.document.rawText).toBeUndefined();
  });
});
