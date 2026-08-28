import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CodeExecutionService } from '../code-execution.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { MockSandboxProvider } from '../providers/mock-sandbox.provider';
import { Judge0Provider } from '../providers/judge0.provider';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ErrorCode, SubmissionStatus } from '@ai-interview/contracts';
import { SandboxSecurityValidator, SANDBOX_LIMITS } from '../utils/sandbox-security.validator';

describe('Sandbox Security Hardening & Constraints (NEW-FUNC-03)', () => {
  let service: CodeExecutionService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      interviewSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-sec-123',
          userId: 'user-cand-123',
        }),
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
        { provide: PrismaService, useValue: mockPrisma },
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

  describe('Sandbox Resource Limits Constants', () => {
    it('enforces exact required sandbox resource bounds', () => {
      expect(SANDBOX_LIMITS.CPU_TIME_LIMIT_SECONDS).toBe(5);
      expect(SANDBOX_LIMITS.WALL_TIME_LIMIT_SECONDS).toBe(10);
      expect(SANDBOX_LIMITS.MEMORY_LIMIT_KB).toBe(128_000); // 128MB
      expect(SANDBOX_LIMITS.STACK_LIMIT_KB).toBe(64_000); // 64MB
      expect(SANDBOX_LIMITS.MAX_FILE_SIZE_KB).toBe(50); // 50KB
      expect(SANDBOX_LIMITS.MAX_SOURCE_CODE_LENGTH).toBe(50_000);
      expect(SANDBOX_LIMITS.MAX_STDIN_LENGTH).toBe(50_000);
    });
  });

  describe('Multi-Language Dangerous Compiler Options Blocking', () => {
    const dangerousCppFlags = [
      '-fplugin=/tmp/evil.so',
      '-Wl,--oformat=binary',
      '-Xlinker -rpath /tmp',
      '-include /etc/passwd',
      '-T /path/to/script.ld',
      '-shared -o /tmp/payload.so',
      '-specs=/etc/specs',
    ];

    dangerousCppFlags.forEach(flag => {
      it(`rejects dangerous C++ compiler flag: ${flag}`, async () => {
        await expect(
          service.executeCode('user-cand-123', 'session-sec-123', {
            language: 'cpp',
            sourceCode: 'int main() { return 0; }',
            compilerOptions: flag,
          }),
        ).rejects.toThrow(DomainException);
      });
    });

    const dangerousJavaFlags = [
      '-agentpath:/tmp/agent.so',
      '-javaagent:/tmp/agent.jar',
      '-Dcom.sun.management.jmxremote',
      '-cp /tmp/evil.jar',
      '--class-path /etc',
      '--add-opens java.base/java.lang=ALL-UNNAMED',
      '-Xbootclasspath:/tmp',
    ];

    dangerousJavaFlags.forEach(flag => {
      it(`rejects dangerous Java compiler flag: ${flag}`, async () => {
        await expect(
          service.executeCode('user-cand-123', 'session-sec-123', {
            language: 'java',
            sourceCode: 'class Solution { public static void main(String[] args) {} }',
            compilerOptions: flag,
          }),
        ).rejects.toThrow(DomainException);
      });
    });

    const dangerousGoFlags = [
      '-exec /bin/sh',
      '-tags dangerous',
      '-ldflags -X main.version=1',
      '-gcflags -m',
      '-toolexec /tmp/tool',
    ];

    dangerousGoFlags.forEach(flag => {
      it(`rejects dangerous Go compiler flag: ${flag}`, async () => {
        await expect(
          service.executeCode('user-cand-123', 'session-sec-123', {
            language: 'go',
            sourceCode: 'package main\nfunc main() {}',
            compilerOptions: flag,
          }),
        ).rejects.toThrow(DomainException);
      });
    });

    const dangerousScriptFlags = [
      '-e console.log(process.mainModule)',
      '--eval "require(\'child_process\')"',
      '--require /tmp/malicious.js',
      '--import ./exploit.mjs',
      '--inspect=0.0.0.0:9229',
    ];

    dangerousScriptFlags.forEach(flag => {
      it(`rejects dangerous JavaScript/TypeScript flag: ${flag}`, async () => {
        await expect(
          service.executeCode('user-cand-123', 'session-sec-123', {
            language: 'typescript',
            sourceCode: 'function solve() { return 1; }',
            compilerOptions: flag,
          }),
        ).rejects.toThrow(DomainException);
      });
    });

    const universalDangerousPatterns = [
      '; rm -rf /',
      '| cat /etc/shadow',
      '&& curl evil.com',
      '`whoami`',
      '$(id)',
      '> /dev/null',
      '../../etc/passwd',
      '/proc/self/mem',
    ];

    universalDangerousPatterns.forEach(pattern => {
      it(`rejects universal dangerous injection: ${pattern}`, async () => {
        await expect(
          service.executeCode('user-cand-123', 'session-sec-123', {
            language: 'python',
            sourceCode: 'def solve(): pass',
            compilerOptions: pattern,
          }),
        ).rejects.toThrow(DomainException);
      });
    });

    it('allows benign compiler options (e.g. -O2, -O3, -std=c++17)', async () => {
      const result = await service.executeCode('user-cand-123', 'session-sec-123', {
        language: 'cpp',
        sourceCode: 'int main() { return 0; }',
        compilerOptions: '-O2 -std=c++17 -Wall',
      });
      expect(result.status).toBe(SubmissionStatus.COMPLETED);
    });
  });

  describe('Stdin and Source Code Size Limits', () => {
    it('rejects customInput exceeding 50KB (50,000 characters)', async () => {
      const hugeStdin = 'x'.repeat(50_001);
      await expect(
        service.executeCode('user-cand-123', 'session-sec-123', {
          language: 'python',
          sourceCode: 'print(input())',
          customInput: hugeStdin,
        }),
      ).rejects.toThrow(DomainException);
    });

    it('rejects testCase input exceeding 50KB', async () => {
      const hugeInput = 'y'.repeat(50_001);
      await expect(
        service.executeCode('user-cand-123', 'session-sec-123', {
          language: 'python',
          sourceCode: 'print(input())',
          testCases: [{ input: hugeInput, expectedOutput: 'ok', isHidden: false, order: 0 }],
        }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('Judge0Provider Remote Payload Constraints', () => {
    it('submits requests with exact 5s CPU, 10s Wall, 128MB RAM, 64MB Stack limits', async () => {
      let capturedBody: any = null;
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((_url, options: any) => {
        capturedBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: { id: 3 },
            stdout: Buffer.from('output').toString('base64'),
            time: '0.04',
            memory: 12000,
          }),
        } as any);
      });

      const judge0 = new Judge0Provider({
        get: jest.fn((key: string) => {
          if (key === 'JUDGE0_API_URL') return 'https://judge0.example.com';
          return null;
        }),
      } as any);

      await judge0.executeCode('python', 'print("hello")', undefined, 'some_stdin');

      expect(capturedBody).toBeDefined();
      expect(capturedBody.cpu_time_limit).toBe(5);
      expect(capturedBody.wall_time_limit).toBe(10);
      expect(capturedBody.memory_limit).toBe(128000);
      expect(capturedBody.stack_limit).toBe(64000);
      expect(capturedBody.max_file_size).toBe(50);

      fetchSpy.mockRestore();
    });
  });
});
