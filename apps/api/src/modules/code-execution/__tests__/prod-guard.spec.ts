import { Test, TestingModule } from '@nestjs/testing';
import { CodeExecutionService } from '../code-execution.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MockSandboxProvider } from '../providers/mock-sandbox.provider';
import { Judge0Provider } from '../providers/judge0.provider';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ErrorCode } from '@ai-interview/contracts';

describe('Code Execution Production Guard & Hidden Test Masking (P1-011)', () => {
  let codeExecutionService: CodeExecutionService;
  let mockSandbox: MockSandboxProvider;

  const mockPrisma = {
    interviewSession: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(''), // No Judge0 URL configured
  };

  beforeEach(async () => {
    mockSandbox = new MockSandboxProvider();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeExecutionService,
        { provide: MockSandboxProvider, useValue: mockSandbox },
        Judge0Provider,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    codeExecutionService = module.get<CodeExecutionService>(CodeExecutionService);
    jest.clearAllMocks();
  });

  it('fails closed in production environment when Judge0 sandbox is not configured', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
      });

      await expect(
        codeExecutionService.executeCode('user-123', 'session-123', {
          language: 'typescript',
          sourceCode: 'function solve() { return 5; }',
        }),
      ).rejects.toThrow(DomainException);

      try {
        await codeExecutionService.executeCode('user-123', 'session-123', {
          language: 'typescript',
          sourceCode: 'function solve() { return 5; }',
        });
      } catch (err: any) {
        expect(err.code).toBe(ErrorCode.CODE_EXECUTION_FAILED);
      }
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('redacts input and expected output for hidden test cases in mock execution', async () => {
    const testCases = [
      { id: 'case-public', input: '1, 2', expectedOutput: '3', isHidden: false, order: 1 },
      { id: 'case-secret', input: '999, 1', expectedOutput: '1000', isHidden: true, order: 2 },
    ];

    const result = await mockSandbox.executeCode(
      'typescript',
      'function add(a, b) { return a + b; }',
      testCases,
    );

    const publicResult = result.testResults.find(t => t.testCaseId === 'case-public');
    const secretResult = result.testResults.find(t => t.testCaseId === 'case-secret');

    expect(publicResult?.input).toBe('1, 2');
    expect(publicResult?.expectedOutput).toBe('3');

    // Hidden test case values MUST be redacted
    expect(secretResult?.input).toBe('[HIDDEN]');
    expect(secretResult?.expectedOutput).toBe('[HIDDEN]');
    expect(secretResult?.actualOutput).toBe('[HIDDEN]');
  });
});
