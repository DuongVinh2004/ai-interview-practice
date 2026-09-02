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

describe('Judge0Provider (Failure Modes & Sandbox Resilience)', () => {
  let provider: Judge0Provider;
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Judge0Provider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JUDGE0_API_URL') return 'https://judge0-test.internal';
              if (key === 'JUDGE0_API_KEY') return 'test-judge0-api-key';
              return '';
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<Judge0Provider>(Judge0Provider);
  });

  it('handles successful code execution with test cases', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: { id: 3, description: 'Accepted' },
        stdout: Buffer.from('42').toString('base64'),
        stderr: null,
        time: '0.045',
        memory: 12400,
      }),
    } as any);

    const result = await provider.executeCode('typescript', 'console.log(42);', [
      { id: 'tc-1', input: '', expectedOutput: '42', isHidden: false, order: 1 },
    ]);

    expect(result.status).toBe('COMPLETED');
    expect(result.allPassed).toBe(true);
    expect(result.testResults[0].passed).toBe(true);
    expect(result.testResults[0].actualOutput).toBe('42');
  });

  it('maps Judge0 status id 5 to TIMEOUT status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: { id: 5, description: 'Time Limit Exceeded' },
        stdout: null,
        stderr: Buffer.from('Time limit exceeded').toString('base64'),
        time: '5.000',
        memory: 15000,
      }),
    } as any);

    const result = await provider.executeCode('python', 'while True: pass');

    expect(result.status).toBe('TIMEOUT');
    expect(result.allPassed).toBe(false);
  });

  it('maps Judge0 status id 6 to COMPILE_ERROR status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: { id: 6, description: 'Compilation Error' },
        stdout: null,
        compile_output: Buffer.from('SyntaxError: unexpected token').toString('base64'),
        time: '0.010',
        memory: 10000,
      }),
    } as any);

    const result = await provider.executeCode('cpp', 'int main() { syntax error }');

    expect(result.status).toBe('COMPILE_ERROR');
    expect(result.compileError).toContain('SyntaxError');
  });

  it('handles remote HTTP 429 rate limit without throwing unhandled exception', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    } as any);

    const result = await provider.executeCode('javascript', 'console.log(1);');

    expect(result.status).toBe('FAILED');
    expect(result.allPassed).toBe(false);
    expect(result.stderr).toContain('429');
  });

  it('handles remote HTTP 500 internal server error gracefully', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as any);

    const result = await provider.executeCode('go', 'package main\nfunc main() {}');

    expect(result.status).toBe('FAILED');
    expect(result.allPassed).toBe(false);
    expect(result.stderr).toContain('500');
  });

  it('handles network error / timeout safely (fail closed)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Fetch network timeout to sandbox'));

    const result = await provider.executeCode('python', 'print("hello")');

    expect(result.status).toBe('FAILED');
    expect(result.allPassed).toBe(false);
    expect(result.stderr).toContain('Fetch network timeout');
  });

  it('rejects unsupported languages cleanly before making remote requests', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as any;

    const result = await provider.executeCode('ruby', 'puts 42');

    expect(result.status).toBe('FAILED');
    expect(result.stderr).toContain("Unsupported language: 'ruby'");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
