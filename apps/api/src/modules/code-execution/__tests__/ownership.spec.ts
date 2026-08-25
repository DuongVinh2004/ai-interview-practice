import { Test, TestingModule } from '@nestjs/testing';
import { CodeExecutionService } from '../code-execution.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MockSandboxProvider } from '../providers/mock-sandbox.provider';
import { Judge0Provider } from '../providers/judge0.provider';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ErrorCode } from '@ai-interview/contracts';

describe('Code Execution IDOR / Ownership Enforcement (P1-003)', () => {
  let codeExecutionService: CodeExecutionService;

  const mockPrisma = {
    interviewSession: {
      findUnique: jest.fn(),
    },
    codeSubmission: {
      findMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(''),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeExecutionService,
        MockSandboxProvider,
        Judge0Provider,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    codeExecutionService = module.get<CodeExecutionService>(CodeExecutionService);
    jest.clearAllMocks();
  });

  const ownerUserId = 'candidate-owner-123';
  const attackerUserId = 'candidate-attacker-456';
  const sessionId = 'session-target-789';

  it('throws FORBIDDEN when user attempts to view another candidate code submissions', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValue({
      id: sessionId,
      userId: ownerUserId,
    });

    await expect(
      codeExecutionService.getSubmissions(attackerUserId, sessionId),
    ).rejects.toThrow(DomainException);

    try {
      await codeExecutionService.getSubmissions(attackerUserId, sessionId);
    } catch (err: any) {
      expect(err.code).toBe(ErrorCode.FORBIDDEN);
    }

    expect(mockPrisma.codeSubmission.findMany).not.toHaveBeenCalled();
  });

  it('allows owner to retrieve their own code submissions', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValue({
      id: sessionId,
      userId: ownerUserId,
    });

    mockPrisma.codeSubmission.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        sessionId,
        turnNumber: 1,
        language: 'typescript',
        sourceCode: 'function solve() {}',
        status: 'COMPLETED',
        timeComplexity: 'O(N)',
        spaceComplexity: 'O(1)',
        aiFeedback: 'Good work',
        aiReview: null,
        executionTimeMs: 25,
        memoryUsageKb: 15000,
        createdAt: new Date(),
      },
    ]);

    const submissions = await codeExecutionService.getSubmissions(ownerUserId, sessionId);
    expect(submissions.length).toBe(1);
    expect(submissions[0].id).toBe('sub-1');
  });
});
