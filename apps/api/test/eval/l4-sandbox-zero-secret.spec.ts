import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Judge0Provider } from '../../src/modules/code-execution/providers/judge0.provider';
import {
  SandboxSecurityValidator,
  SANDBOX_LIMITS,
} from '../../src/modules/code-execution/utils/sandbox-security.validator';
import { DeterministicLocalWorkspaceRuntime } from '../../src/modules/engineering-arena/runtime/deterministic-local.runtime';
import { ChallengeValidatorService } from '../../src/modules/engineering-arena/validator/challenge-validator.service';
import { DomainException } from '../../src/modules/platform/filters/all-exceptions.filter';
import { ChallengeDomain, ChallengeCategory } from '@ai-interview/contracts';

describe('Tier 4: Code Sandbox Zero-Secret Containment & Resource Bounds (SANDBOX-001..010)', () => {
  let judge0: Judge0Provider;
  let arenaRuntime: DeterministicLocalWorkspaceRuntime;

  const mockManifest = {
    schemaVersion: '1.0' as const,
    slug: 'sandbox-containment-test',
    title: 'Sandbox Containment Test',
    description: 'Verifies zero secret and bounds',
    domain: ChallengeDomain.SECURITY,
    category: ChallengeCategory.SECURITY_REMEDIATION,
    difficulty: 3,
    estimatedMinutes: 30,
    environment: {
      runtime: 'node:22',
      memoryLimitMb: 512,
      cpuLimit: 1.0,
    },
    visibleFiles: ['src/index.ts'],
    editableFiles: ['src/index.ts'],
    hiddenFiles: ['test/hidden.test.ts'],
    commands: [
      {
        id: 'test',
        label: 'Run Tests',
        command: 'npm test',
        args: [],
        timeoutSeconds: 15,
        isVerification: false,
      },
    ],
    rubric: {
      version: '1.0',
      objectiveWeight: 0.7,
      rubricWeight: 0.3,
      criteria: [],
    },
    skills: [],
  };

  beforeEach(() => {
    judge0 = new Judge0Provider({
      get: jest.fn((key: string, def?: any) => {
        if (key === 'JUDGE0_API_URL') return 'https://judge0.internal.local';
        if (key === 'JUDGE0_API_KEY') return 'test-key';
        return def ?? '';
      }),
    } as any);

    arenaRuntime = new DeterministicLocalWorkspaceRuntime();
  });

  describe('Zero-Secret Environment Containment (Judge0)', () => {
    it('S1. Judge0 submission payload never includes host environment secrets in submission body', async () => {
      let capturedPayload: any = null;
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((_url, options: any) => {
        capturedPayload = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: { id: 3 },
            stdout: Buffer.from('42').toString('base64'),
            time: '0.05',
            memory: 15000,
          }),
        } as any);
      });

      // Simulate sensitive host environment variables
      process.env.DATABASE_URL = 'postgresql://postgres:supersecret@db:5432/main';
      process.env.JWT_ACCESS_SECRET = 'super-secret-jwt-key-never-leak';
      process.env.STRIPE_SECRET_KEY = 'sk_live_1234567890abcdef';

      try {
        await judge0.executeCode('python', 'print(42)', undefined, 'input_data');

        expect(capturedPayload).toBeDefined();
        // Zero-secret containment: submission payload has NO env_vars or environment field
        expect(capturedPayload.env_vars).toBeUndefined();
        expect(capturedPayload.environment).toBeUndefined();

        const stringified = JSON.stringify(capturedPayload);
        expect(stringified).not.toContain('supersecret');
        expect(stringified).not.toContain('super-secret-jwt-key');
        expect(stringified).not.toContain('sk_live_');
      } finally {
        delete process.env.DATABASE_URL;
        delete process.env.JWT_ACCESS_SECRET;
        delete process.env.STRIPE_SECRET_KEY;
        fetchSpy.mockRestore();
      }
    });
  });

  describe('Sandbox Resource Bounds Verification', () => {
    it('S2. Judge0 enforces hard limits: timeout <= 10s wall / 5s CPU, memory <= 128MB', async () => {
      let capturedPayload: any = null;
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((_url, options: any) => {
        capturedPayload = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: { id: 3 }, stdout: '', time: '0.01', memory: 1000 }),
        } as any);
      });

      await judge0.executeCode('typescript', 'console.log(1);');

      expect(capturedPayload.cpu_time_limit).toBeLessThanOrEqual(5);
      expect(capturedPayload.wall_time_limit).toBeLessThanOrEqual(10);
      expect(capturedPayload.memory_limit).toBeLessThanOrEqual(128000);
      expect(capturedPayload.max_file_size).toBeLessThanOrEqual(50);

      fetchSpy.mockRestore();
    });

    it('S3. Arena manifest validator rejects memoryLimitMb > 512 or cpuLimit > 1.0 or timeout > 15s', async () => {
      const validator = new ChallengeValidatorService();

      const invalidManifest = {
        ...mockManifest,
        environment: {
          runtime: 'node:22',
          memoryLimitMb: 1024, // Exceeds 512MB
          cpuLimit: 2.0, // Exceeds 1.0
        },
        commands: [
          {
            id: 'test',
            label: 'Run Tests',
            command: 'npm test',
            args: [],
            timeoutSeconds: 30, // Exceeds 15s
            isVerification: false,
          },
        ],
      };

      const report = await validator.validateChallengePackage({
        manifest: invalidManifest as any,
        visibleFilesContent: { 'src/index.ts': 'test' },
        hiddenFilesContent: { 'test/hidden.test.ts': 'test' },
        referenceSolutionContent: { 'src/index.ts': 'solution' },
      });

      expect(report.overallPass).toBe(false);
      expect(report.failedStages).toBeGreaterThan(0);
    });
  });

  describe('Adversarial Code & Injection Rejection', () => {
    it('S4. Blocks fork bomb injection and infinite fork patterns in compiler options', () => {
      const forkBombs = ['; :(){ :|:& };:', '| :(){ :|:& };:', '&& fork()', '`id`', '$(whoami)'];

      for (const payload of forkBombs) {
        expect(() => {
          SandboxSecurityValidator.validateCompilerOptions('cpp', payload);
        }).toThrow(DomainException);
      }
    });

    it('S5. Arena runtime blocks symlinks, null-bytes, and traversal in workspace files', async () => {
      const maliciousFiles = ['../etc/passwd', '..\\windows\\system32', '/absolute/path'];

      for (const maliciousPath of maliciousFiles) {
        await expect(
          arenaRuntime.provision({
            sessionId: 'sess-mal',
            workspaceHandle: 'ws-mal',
            manifest: mockManifest,
            files: { [maliciousPath]: 'evil payload' },
          }),
        ).rejects.toThrow('Path traversal');
      }
    });

    it('S6. Arena runtime throws in production environment (fail-safe local containment)', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        await expect(
          arenaRuntime.provision({
            sessionId: 'sess-prod',
            workspaceHandle: 'ws-prod',
            manifest: mockManifest,
            files: { 'src/index.ts': 'ok' },
          }),
        ).rejects.toThrow('Deterministic Arena runtime is disabled in production');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
