import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { TextExtractorService } from './services/text-extractor.service';
import { CvAnalyzerService } from './services/cv-analyzer.service';
import { JdAnalyzerService } from './services/jd-analyzer.service';
import { BlueprintGeneratorService } from './services/blueprint-generator.service';
import {
  ParseCvRequest,
  AnalyzeJdRequest,
  GenerateBlueprintRequest,
  ParsedProfileDto,
  JdAnalysisDto,
} from '@ai-interview/contracts';

@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly textExtractor: TextExtractorService,
    private readonly cvAnalyzer: CvAnalyzerService,
    private readonly jdAnalyzer: JdAnalyzerService,
    private readonly blueprintGenerator: BlueprintGeneratorService,
  ) {}

  /**
   * Uploads and parses CV text / document, saving UserDocument and ParsedProfile with 30-day TTL.
   */
  async parseCv(userId: string, req: ParseCvRequest, buffer?: Buffer) {
    let rawText = req.rawText;
    if (buffer) {
      rawText = await this.textExtractor.extractText(buffer, req.fileType, req.fileName);
    }

    if (!rawText || rawText.trim().length < 10) {
      throw new BadRequestException('Resume text is too short or empty to parse.');
    }

    // 30-day TTL expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const scrubbedRawText = this.scrubPii(rawText);

    const doc = await this.prisma.userDocument.create({
      data: {
        userId,
        fileName: req.fileName,
        fileType: req.fileType,
        rawText: scrubbedRawText,
        status: 'PARSED',
        expiresAt,
      },
    });

    const parsedData = await this.cvAnalyzer.analyzeCv(rawText);

    const profile = await this.prisma.parsedProfile.create({
      data: {
        documentId: doc.id,
        fullName: parsedData.fullName || '[CANDIDATE]',
        targetRole: parsedData.targetRole || 'Software Engineer',
        seniorityLevel: parsedData.seniorityLevel || 'MID',
        skills: parsedData.skills as any,
        experience: parsedData.experience as any,
        education: parsedData.education as any,
        rawSummary: parsedData.rawSummary || '',
      },
    });

    return {
      document: {
        ...doc,
        rawText: undefined,
      },
      parsedProfile: profile,
    };
  }

  private scrubPii(text: string): string {
    // Mask emails
    let scrubbed = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL_REDACTED]');
    // Mask phone numbers (formats with country codes, dashes, parentheses)
    scrubbed = scrubbed.replace(
      /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
      '[PHONE_REDACTED]',
    );
    // Mask SSN / national ID numbers
    scrubbed = scrubbed.replace(/\b\d{3}-\d{2}-\d{4}\b|\b\d{9,12}\b/g, '[ID_REDACTED]');
    return scrubbed;
  }

  /**
   * Analyzes job description text and stores JdAnalysis record.
   */
  async analyzeJd(userId: string, req: AnalyzeJdRequest) {
    if (!req.jdText || req.jdText.trim().length < 20) {
      throw new BadRequestException('Job description text must contain at least 20 characters.');
    }

    const jdAnalysis = await this.jdAnalyzer.analyzeJd(req.jdText, req.roleTitle);

    return this.prisma.jdAnalysis.create({
      data: {
        userId,
        rawJdText: req.jdText,
        roleTitle: jdAnalysis.roleTitle,
        requiredSkills: jdAnalysis.requiredSkills as any,
        preferredSkills: jdAnalysis.preferredSkills as any,
        responsibilities: jdAnalysis.responsibilities as any,
        seniorityLevel: jdAnalysis.seniorityLevel,
        companyContext: jdAnalysis.companyContext,
      },
    });
  }

  /**
   * Combines a parsed CV profile and JD analysis to generate an InterviewBlueprint.
   */
  async generateBlueprint(userId: string, req: GenerateBlueprintRequest) {
    const profile = await this.prisma.parsedProfile.findUnique({
      where: { id: req.parsedProfileId },
      include: { document: true },
    });

    if (!profile) {
      throw new NotFoundException('Parsed profile not found.');
    }
    if (profile.document.userId !== userId) {
      throw new ForbiddenException('You do not have access to this parsed profile.');
    }

    const jd = await this.prisma.jdAnalysis.findUnique({
      where: { id: req.jdAnalysisId },
    });

    if (!jd) {
      throw new NotFoundException('Job description analysis not found.');
    }
    if (jd.userId !== userId) {
      throw new ForbiddenException('You do not have access to this JD analysis.');
    }

    const profileDto: ParsedProfileDto = {
      id: profile.id,
      documentId: profile.documentId,
      fullName: profile.fullName,
      targetRole: profile.targetRole,
      seniorityLevel: profile.seniorityLevel,
      skills: (profile.skills as string[]) || [],
      experience: (profile.experience as any[]) || [],
      education: (profile.education as string[]) || [],
      rawSummary: profile.rawSummary,
    };

    const jdDto: JdAnalysisDto = {
      id: jd.id,
      roleTitle: jd.roleTitle,
      requiredSkills: (jd.requiredSkills as string[]) || [],
      preferredSkills: (jd.preferredSkills as string[]) || [],
      responsibilities: (jd.responsibilities as string[]) || [],
      seniorityLevel: jd.seniorityLevel,
      companyContext: jd.companyContext,
    };

    const blueprintData = this.blueprintGenerator.generateBlueprint(
      profile.id,
      jd.id,
      profileDto,
      jdDto,
      req.targetRole,
      req.targetLevel,
    );

    return this.prisma.interviewBlueprint.create({
      data: {
        parsedProfileId: blueprintData.parsedProfileId,
        jdAnalysisId: blueprintData.jdAnalysisId,
        matchedSkills: blueprintData.matchedSkills as any,
        gapSkills: blueprintData.gapSkills as any,
        matchPercentage: blueprintData.matchPercentage,
        topics: blueprintData.topics as any,
        recommendations: blueprintData.recommendations as any,
        targetRole: blueprintData.targetRole,
        targetLevel: blueprintData.targetLevel,
      },
    });
  }

  async getUserDocuments(userId: string) {
    return this.prisma.userDocument.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        fileName: true,
        fileType: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        parsedProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserProfiles(userId: string) {
    return this.prisma.parsedProfile.findMany({
      where: {
        document: { userId },
      },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserBlueprints(userId: string) {
    return this.prisma.interviewBlueprint.findMany({
      where: {
        parsedProfile: {
          document: { userId },
        },
      },
      include: {
        parsedProfile: true,
        jdAnalysis: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBlueprint(userId: string, id: string) {
    const blueprint = await this.prisma.interviewBlueprint.findUnique({
      where: { id },
      include: {
        parsedProfile: {
          include: { document: true },
        },
        jdAnalysis: true,
      },
    });
    if (!blueprint) {
      throw new NotFoundException('Interview blueprint not found');
    }

    const docOwnerId = blueprint.parsedProfile?.document?.userId;
    const jdOwnerId = blueprint.jdAnalysis?.userId;

    if (docOwnerId && docOwnerId !== userId && jdOwnerId && jdOwnerId !== userId) {
      throw new ForbiddenException('You do not have access to this interview blueprint.');
    }

    return blueprint;
  }

  async deleteDocument(userId: string, documentId: string) {
    const doc = await this.prisma.userDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    if (doc.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.userDocument.delete({
      where: { id: documentId },
    });

    return { success: true };
  }
}
