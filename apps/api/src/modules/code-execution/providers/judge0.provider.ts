import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SandboxProvider } from '../interfaces/sandbox-provider.interface';
import { ExecuteCodeResponse, TestCaseDto, SubmissionStatus } from '@ai-interview/contracts';
import { SANDBOX_LIMITS, SandboxSecurityValidator } from '../utils/sandbox-security.validator';

const LANGUAGE_ID_MAP: Record<string, number> = {
  javascript: 63, // Node.js
  typescript: 74, // TypeScript
  python: 71, // Python 3
  java: 62, // OpenJDK 13
  cpp: 54, // C++ (GCC 9.2.0)
  go: 60, // Go
};

@Injectable()
export class Judge0Provider implements SandboxProvider {
  readonly name = 'judge0';
  private readonly logger = new Logger(Judge0Provider.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('JUDGE0_API_URL', '');
    this.apiKey = this.configService.get<string>('JUDGE0_API_KEY', '');
  }

  async executeCode(
    language: string,
    sourceCode: string,
    testCases?: TestCaseDto[],
    customInput?: string,
    compilerOptions?: string,
  ): Promise<ExecuteCodeResponse> {
    const langId = LANGUAGE_ID_MAP[language.toLowerCase()];
    if (!langId) {
      this.logger.error(`Unsupported language requested: ${language}`);
      return {
        status: SubmissionStatus.FAILED,
        stdout: '',
        stderr: `Unsupported language: '${language}'. Supported: ${Object.keys(LANGUAGE_ID_MAP).join(', ')}`,
        executionTimeMs: 0,
        memoryUsageKb: 0,
        compileError: null,
        testResults: (testCases || []).map(tc => ({
          testCaseId: tc.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: '',
          passed: false,
          executionTimeMs: 0,
          memoryUsageKb: 0,
          errorMsg: `Unsupported language: '${language}'`,
        })),
        allPassed: false,
      };
    }

    // Security & Constraints Validation before remote calls
    try {
      SandboxSecurityValidator.validateCompilerOptions(language, compilerOptions);
      SandboxSecurityValidator.validateStdin(customInput);
      if (testCases) {
        for (const tc of testCases) {
          SandboxSecurityValidator.validateStdin(tc.input);
        }
      }
    } catch (err: any) {
      this.logger.error(`Security constraint violation: ${err.message}`);
      return {
        status: SubmissionStatus.COMPILE_ERROR,
        stdout: '',
        stderr: err.message,
        compileError: err.message,
        executionTimeMs: 0,
        memoryUsageKb: 0,
        testResults: (testCases || []).map(tc => ({
          testCaseId: tc.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: '',
          passed: false,
          executionTimeMs: 0,
          memoryUsageKb: 0,
          errorMsg: err.message,
        })),
        allPassed: false,
      };
    }

    if (!this.apiUrl) {
      this.logger.error('Judge0 API URL is not configured. Failing closed.');
      return {
        status: SubmissionStatus.FAILED,
        stdout: '',
        stderr: 'Judge0 API URL is not configured',
        executionTimeMs: 0,
        memoryUsageKb: 0,
        compileError: null,
        testResults: (testCases || []).map(tc => ({
          testCaseId: tc.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: '',
          passed: false,
          executionTimeMs: 0,
          memoryUsageKb: 0,
          errorMsg: 'Judge0 API URL is not configured',
        })),
        allPassed: false,
      };
    }

    const MAX_TEST_CASES = SANDBOX_LIMITS.MAX_TEST_CASES;
    if (testCases && testCases.length > MAX_TEST_CASES) {
      this.logger.error(
        `Test case batch size (${testCases.length}) exceeds maximum limit of ${MAX_TEST_CASES}`,
      );
      return {
        status: SubmissionStatus.FAILED,
        stdout: '',
        stderr: `Exceeded maximum allowed test cases (${MAX_TEST_CASES}) per execution`,
        executionTimeMs: 0,
        memoryUsageKb: 0,
        compileError: null,
        testResults: [],
        allPassed: false,
      };
    }

    if (sourceCode && sourceCode.length > SANDBOX_LIMITS.MAX_SOURCE_CODE_LENGTH) {
      this.logger.error(
        `Source code size (${sourceCode.length}) exceeds limit of ${SANDBOX_LIMITS.MAX_SOURCE_CODE_LENGTH} chars`,
      );
      return {
        status: SubmissionStatus.FAILED,
        stdout: '',
        stderr: `Source code exceeds maximum allowed size (${SANDBOX_LIMITS.MAX_SOURCE_CODE_LENGTH.toLocaleString()} characters)`,
        executionTimeMs: 0,
        memoryUsageKb: 0,
        compileError: null,
        testResults: [],
        allPassed: false,
      };
    }

    if (testCases && testCases.length > 0) {
      const results: any[] = [];
      let totalTime = 0;
      let maxMemory = 0;
      let overallStatus = SubmissionStatus.COMPLETED;
      let compileErr: string | null = null;
      let lastStdout = '';
      let lastStderr: string | null = null;

      for (const tc of testCases) {
        try {
          const submissionPayload: Record<string, any> = {
            source_code: Buffer.from(sourceCode).toString('base64'),
            language_id: langId,
            stdin: Buffer.from(tc.input || '').toString('base64'),
            cpu_time_limit: SANDBOX_LIMITS.CPU_TIME_LIMIT_SECONDS,
            wall_time_limit: SANDBOX_LIMITS.WALL_TIME_LIMIT_SECONDS,
            memory_limit: SANDBOX_LIMITS.MEMORY_LIMIT_KB,
            stack_limit: SANDBOX_LIMITS.STACK_LIMIT_KB,
            max_file_size: SANDBOX_LIMITS.MAX_FILE_SIZE_KB,
          };

          if (compilerOptions) {
            submissionPayload.compiler_options = compilerOptions;
          }

          const response = await fetch(`${this.apiUrl}/submissions?wait=true`, {
            method: 'POST',
            signal: AbortSignal.timeout(SANDBOX_LIMITS.WALL_TIME_LIMIT_SECONDS * 1000),
            headers: {
              'Content-Type': 'application/json',
              ...(this.apiKey ? { 'X-Auth-Token': this.apiKey } : {}),
            },
            body: JSON.stringify(submissionPayload),
          });

          if (!response.ok) {
            throw new Error(`Judge0 API returned HTTP ${response.status}`);
          }

          const data = (await response.json()) as any;
          const statusId = data.status?.id;

          let caseStatus = SubmissionStatus.COMPLETED;
          if (statusId === 5) caseStatus = SubmissionStatus.TIMEOUT;
          else if (statusId === 6) caseStatus = SubmissionStatus.COMPILE_ERROR;
          else if (statusId >= 7) caseStatus = SubmissionStatus.FAILED;

          const stdout = data.stdout
            ? Buffer.from(data.stdout, 'base64').toString('utf8').trim()
            : '';
          const stderr = data.stderr ? Buffer.from(data.stderr, 'base64').toString('utf8') : null;
          const compileOutput = data.compile_output
            ? Buffer.from(data.compile_output, 'base64').toString('utf8')
            : null;

          if (compileOutput) compileErr = compileOutput;
          if (
            caseStatus !== SubmissionStatus.COMPLETED &&
            overallStatus === SubmissionStatus.COMPLETED
          ) {
            overallStatus = caseStatus;
          }

          const executionTimeMs = Math.round((parseFloat(data.time) || 0.05) * 1000);
          const memoryUsageKb = data.memory || 15000;
          totalTime += executionTimeMs;
          maxMemory = Math.max(maxMemory, memoryUsageKb);
          lastStdout = stdout;
          lastStderr = stderr;

          const expected = tc.expectedOutput?.trim() || '';
          const passed = caseStatus === SubmissionStatus.COMPLETED && stdout === expected;

          results.push({
            testCaseId: tc.id,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: stdout,
            passed,
            executionTimeMs,
            memoryUsageKb,
            errorMsg: stderr || (passed ? null : `Expected: "${expected}", Actual: "${stdout}"`),
          });
        } catch (err: any) {
          results.push({
            testCaseId: tc.id,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: '',
            passed: false,
            executionTimeMs: 0,
            memoryUsageKb: 0,
            errorMsg: err.message,
          });
        }
      }

      const allPassed = results.length > 0 && results.every(r => r.passed);

      return {
        status: overallStatus,
        stdout: lastStdout,
        stderr: lastStderr,
        compileError: compileErr,
        executionTimeMs: totalTime,
        memoryUsageKb: maxMemory,
        testResults: results,
        allPassed,
      };
    }

    try {
      const singlePayload: Record<string, any> = {
        source_code: Buffer.from(sourceCode).toString('base64'),
        language_id: langId,
        stdin: Buffer.from(customInput || '').toString('base64'),
        cpu_time_limit: SANDBOX_LIMITS.CPU_TIME_LIMIT_SECONDS,
        wall_time_limit: SANDBOX_LIMITS.WALL_TIME_LIMIT_SECONDS,
        memory_limit: SANDBOX_LIMITS.MEMORY_LIMIT_KB,
        stack_limit: SANDBOX_LIMITS.STACK_LIMIT_KB,
        max_file_size: SANDBOX_LIMITS.MAX_FILE_SIZE_KB,
      };

      if (compilerOptions) {
        singlePayload.compiler_options = compilerOptions;
      }

      const response = await fetch(`${this.apiUrl}/submissions?wait=true`, {
        method: 'POST',
        signal: AbortSignal.timeout(SANDBOX_LIMITS.WALL_TIME_LIMIT_SECONDS * 1000),
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'X-Auth-Token': this.apiKey } : {}),
        },
        body: JSON.stringify(singlePayload),
      });

      if (!response.ok) {
        throw new Error(`Judge0 API returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as any;
      const statusId = data.status?.id;

      let status = SubmissionStatus.COMPLETED;
      if (statusId === 5) status = SubmissionStatus.TIMEOUT;
      else if (statusId === 6) status = SubmissionStatus.COMPILE_ERROR;
      else if (statusId >= 7) status = SubmissionStatus.FAILED;

      const stdout = data.stdout ? Buffer.from(data.stdout, 'base64').toString('utf8') : '';
      const stderr = data.stderr ? Buffer.from(data.stderr, 'base64').toString('utf8') : null;
      const compileOutput = data.compile_output
        ? Buffer.from(data.compile_output, 'base64').toString('utf8')
        : null;

      return {
        status,
        stdout,
        stderr,
        compileError: compileOutput,
        executionTimeMs: Math.round((parseFloat(data.time) || 0.05) * 1000),
        memoryUsageKb: data.memory || 15000,
        testResults: [],
        allPassed: status === SubmissionStatus.COMPLETED,
      };
    } catch (err: any) {
      this.logger.error(`Judge0 execution error: ${err.message}`);
      return {
        status: SubmissionStatus.FAILED,
        stdout: '',
        stderr: err.message,
        compileError: null,
        executionTimeMs: 0,
        memoryUsageKb: 0,
        testResults: [],
        allPassed: false,
      };
    }
  }
}
