import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CodeExecutionService } from './code-execution.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { MockSandboxProvider } from './providers/mock-sandbox.provider';
import { Judge0Provider } from './providers/judge0.provider';
import { SubmissionStatus } from '@ai-interview/contracts';

describe('CodeExecutionService (F002)', () => {
  let service: CodeExecutionService;
  let prismaMock: any;

  const mockSession = {
    id: 'session-code-123',
    userId: 'user-cand-123',
    sessionMode: 'CODING',
    codeTestCases: [
      { id: 'tc-1', input: '[2, 7, 11, 15], target = 9', expectedOutput: '[0, 1]', isHidden: false, order: 1 },
      { id: 'tc-2', input: '[3, 2, 4], target = 6', expectedOutput: '[1, 2]', isHidden: true, order: 2 },
    ],
  };

  const mockSubmissionsDb: any[] = [];

  beforeEach(async () => {
    mockSubmissionsDb.length = 0;

    prismaMock = {
      interviewSession: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockSession.id) {
            return Promise.resolve(mockSession);
          }
          return Promise.resolve(null);
        }),
      },
      codeSubmission: {
        create: jest.fn().mockImplementation(({ data }) => {
          const sub = {
            id: 'sub-uuid-1',
            createdAt: new Date(),
            ...data,
          };
          mockSubmissionsDb.push(sub);
          return Promise.resolve(sub);
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve([...mockSubmissionsDb])),
      },
      codeExecutionResult: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeExecutionService,
        MockSandboxProvider,
        Judge0Provider,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def: any) => def),
          },
        },
      ],
    }).compile();

    service = module.get<CodeExecutionService>(CodeExecutionService);
  });

  it('should run code execution successfully with mock sandbox', async () => {
    const result = await service.executeCode('user-cand-123', 'session-code-123', {
      language: 'javascript',
      sourceCode: 'function twoSum(nums, target) { return [0, 1]; }',
      customInput: '[2, 7, 11, 15], 9',
    });

    expect(result.status).toBe(SubmissionStatus.COMPLETED);
    expect(result.allPassed).toBe(true);
    expect(result.testResults.length).toBeGreaterThan(0);
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });

  it('should submit code, run test cases, and attach AI complexity review', async () => {
    const response = await service.submitCode('user-cand-123', 'session-code-123', {
      turnNumber: 1,
      language: 'python',
      sourceCode: `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return []`,
    });

    expect(response.id).toBeDefined();
    expect(response.status).toBe(SubmissionStatus.COMPLETED);
    expect(response.aiReview).toBeDefined();
    expect(response.aiReview?.timeComplexity).toBe('O(n)');
    expect(response.aiReview?.spaceComplexity).toBe('O(n)');
    expect(response.aiReview?.codeQualityScore).toBeGreaterThanOrEqual(8.0);
    expect(prismaMock.codeSubmission.create).toHaveBeenCalled();
  });

  it('should detect quadratic time complexity for nested loops', async () => {
    const response = await service.submitCode('user-cand-123', 'session-code-123', {
      turnNumber: 1,
      language: 'javascript',
      sourceCode: `function twoSum(nums, target) {
    for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] === target) return [i, j];
        }
    }
    return [];
}`,
    });

    expect(response.aiReview?.timeComplexity).toBe('O(n^2)');
  });

  it('should fail closed if Judge0 is configured without API URL', async () => {
    const unconfiguredJudge0 = new Judge0Provider({
      get: jest.fn(() => ''),
    } as any);

    const result = await unconfiguredJudge0.executeCode('python', 'print("hello")', [
      { id: 'tc-1', input: '', expectedOutput: 'hello', isHidden: false, order: 1 },
    ]);

    expect(result.status).toBe(SubmissionStatus.FAILED);
    expect(result.allPassed).toBe(false);
    expect(result.stderr).toContain('Judge0 API URL is not configured');
    expect(result.testResults[0].passed).toBe(false);
  });
});
