import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import {
  ErrorCode,
  AuditAction,
  ExecuteCodeResponse,
  CodeSubmissionResponse,
  AiCodeReview,
  SubmissionStatus,
} from '@ai-interview/contracts';
import { MockSandboxProvider } from './providers/mock-sandbox.provider';
import { Judge0Provider } from './providers/judge0.provider';
import { ExecuteCodeDto, SubmitCodeDto } from './dto/code-execution.dto';

@Injectable()
export class CodeExecutionService {
  private readonly logger = new Logger(CodeExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mockSandbox: MockSandboxProvider,
    private readonly judge0Sandbox: Judge0Provider,
  ) {}

  private getSandboxProvider() {
    const judge0Url = this.configService.get<string>('JUDGE0_API_URL', '');
    if (judge0Url) {
      return this.judge0Sandbox;
    }
    return this.mockSandbox;
  }

  async executeCode(
    userId: string,
    sessionId: string,
    dto: ExecuteCodeDto,
  ): Promise<ExecuteCodeResponse> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new DomainException(
        ErrorCode.SESSION_NOT_FOUND,
        'Interview session not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (session.userId !== userId) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Access to this interview session is forbidden',
        HttpStatus.FORBIDDEN,
      );
    }

    const provider = this.getSandboxProvider();
    const result = await provider.executeCode(
      dto.language,
      dto.sourceCode,
      dto.testCases,
      dto.customInput,
    );

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.CODE_EXECUTED,
        resource: 'code_execution',
        resourceId: sessionId,
        details: { language: dto.language, status: result.status },
      },
    });

    return result;
  }

  async submitCode(
    userId: string,
    sessionId: string,
    dto: SubmitCodeDto,
  ): Promise<CodeSubmissionResponse> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        codeTestCases: {
          where: { turnNumber: dto.turnNumber },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!session) {
      throw new DomainException(
        ErrorCode.SESSION_NOT_FOUND,
        'Interview session not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (session.userId !== userId) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Access to this interview session is forbidden',
        HttpStatus.FORBIDDEN,
      );
    }

    // Run against test cases
    const provider = this.getSandboxProvider();
    const execResult = await provider.executeCode(
      dto.language,
      dto.sourceCode,
      session.codeTestCases.map(tc => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden,
        order: tc.order,
      })),
    );

    // AI Code Review Analysis
    const aiReview: AiCodeReview = this.analyzeCodeQuality(dto.language, dto.sourceCode, execResult);

    // Persist submission in DB
    const submission = await this.prisma.codeSubmission.create({
      data: {
        sessionId,
        turnNumber: dto.turnNumber,
        language: dto.language,
        sourceCode: dto.sourceCode,
        status: execResult.status as any,
        timeComplexity: aiReview.timeComplexity,
        spaceComplexity: aiReview.spaceComplexity,
        aiFeedback: aiReview.complexityAnalysis,
        aiReview: aiReview as any,
        executionTimeMs: execResult.executionTimeMs,
        memoryUsageKb: execResult.memoryUsageKb,
      },
    });

    // Save individual test results
    if (execResult.testResults && execResult.testResults.length > 0) {
      await this.prisma.codeExecutionResult.createMany({
        data: execResult.testResults.map(tr => ({
          submissionId: submission.id,
          testCaseId: tr.testCaseId || null,
          status: (tr.passed ? SubmissionStatus.COMPLETED : SubmissionStatus.FAILED) as any,
          stdout: execResult.stdout,
          stderr: tr.errorMsg || execResult.stderr,
          actualOutput: tr.actualOutput,
          passed: tr.passed,
          executionTimeMs: tr.executionTimeMs,
          memoryUsageKb: tr.memoryUsageKb,
        })),
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.CODE_SUBMITTED,
        resource: 'code_submission',
        resourceId: submission.id,
        details: {
          language: dto.language,
          status: submission.status,
          timeComplexity: aiReview.timeComplexity,
        },
      },
    });

    return {
      id: submission.id,
      sessionId: submission.sessionId,
      turnNumber: submission.turnNumber,
      language: submission.language as any,
      sourceCode: submission.sourceCode,
      status: submission.status as any,
      timeComplexity: submission.timeComplexity,
      spaceComplexity: submission.spaceComplexity,
      aiFeedback: submission.aiFeedback,
      aiReview,
      executionTimeMs: submission.executionTimeMs,
      memoryUsageKb: submission.memoryUsageKb,
      createdAt: submission.createdAt.toISOString(),
    };
  }

  async getSubmissions(sessionId: string): Promise<CodeSubmissionResponse[]> {
    const submissions = await this.prisma.codeSubmission.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });

    return submissions.map(s => ({
      id: s.id,
      sessionId: s.sessionId,
      turnNumber: s.turnNumber,
      language: s.language as any,
      sourceCode: s.sourceCode,
      status: s.status as any,
      timeComplexity: s.timeComplexity,
      spaceComplexity: s.spaceComplexity,
      aiFeedback: s.aiFeedback,
      aiReview: (s.aiReview as any) || undefined,
      executionTimeMs: s.executionTimeMs,
      memoryUsageKb: s.memoryUsageKb,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  private analyzeCodeQuality(
    language: string,
    sourceCode: string,
    execResult: ExecuteCodeResponse,
  ): AiCodeReview {
    let timeComplexity = 'O(n)';
    let spaceComplexity = 'O(1)';

    const clean = sourceCode.toLowerCase();
    if (clean.includes('for') && (clean.match(/for/g) || []).length >= 2) {
      timeComplexity = 'O(n^2)';
    } else if (clean.includes('sort') || clean.includes('.sort(')) {
      timeComplexity = 'O(n log n)';
    } else if (clean.includes('while') && clean.includes('/ 2') || clean.includes('>> 1')) {
      timeComplexity = 'O(log n)';
    }

    if (clean.includes('new map') || clean.includes('new set') || clean.includes('{}') || clean.includes('[]')) {
      spaceComplexity = 'O(n)';
    }

    const cleanCodeFeedback: string[] = [];
    const edgeCases: string[] = [
      'Null / Empty input handling',
      'Large input scalability (10^5 elements)',
      'Negative values / Boundary conditions',
    ];

    if (sourceCode.length > 500) {
      cleanCodeFeedback.push('Consider decomposing helper logic into smaller modular functions.');
    } else {
      cleanCodeFeedback.push('Concise and well-structured implementation.');
    }

    if (!clean.includes('if') || clean.includes('throw')) {
      cleanCodeFeedback.push('Ensure guard clauses validate null or empty parameters at the entry point.');
    }

    const codeQualityScore = execResult.allPassed ? 8.5 : 5.0;

    return {
      timeComplexity,
      spaceComplexity,
      complexityAnalysis: `The solution exhibits ${timeComplexity} asymptotic time complexity and ${spaceComplexity} auxiliary memory space.`,
      codeQualityScore,
      cleanCodeFeedback,
      edgeCasesIdentified: edgeCases,
      optimizedSolutionSnippet: undefined,
    };
  }
}
