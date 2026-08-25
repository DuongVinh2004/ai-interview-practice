import { Injectable } from '@nestjs/common';
import { SandboxProvider } from '../interfaces/sandbox-provider.interface';
import { ExecuteCodeResponse, TestCaseDto, SubmissionStatus } from '@ai-interview/contracts';

@Injectable()
export class MockSandboxProvider implements SandboxProvider {
  readonly name = 'mock';

  async executeCode(
    language: string,
    sourceCode: string,
    testCases?: TestCaseDto[],
    customInput?: string,
  ): Promise<ExecuteCodeResponse> {
    // Quick syntax or runtime error simulation if source has intentional error keywords
    if (sourceCode.includes('SYNTAX_ERROR')) {
      return {
        status: SubmissionStatus.COMPILE_ERROR,
        stdout: '',
        stderr: 'SyntaxError: Unexpected token or invalid identifier',
        compileError: 'SyntaxError on line 3: unexpected syntax',
        executionTimeMs: 12,
        memoryUsageKb: 14200,
        testResults: [],
        allPassed: false,
      };
    }

    if (sourceCode.includes('INFINITE_LOOP')) {
      return {
        status: SubmissionStatus.TIMEOUT,
        stdout: '',
        stderr: 'Execution timed out after 10000ms',
        compileError: null,
        executionTimeMs: 10000,
        memoryUsageKb: 256000,
        testResults: [],
        allPassed: false,
      };
    }

    const cases =
      testCases && testCases.length > 0
        ? testCases
        : [
            {
              id: 'case-1',
              input: customInput || '2, 3',
              expectedOutput: '5',
              isHidden: false,
              order: 1,
            },
            { id: 'case-2', input: '10, -5', expectedOutput: '5', isHidden: true, order: 2 },
          ];

    const testResults = cases.map(tc => {
      // In mock mode, if code contains return or print, simulate passing output
      const actualOutput = tc.expectedOutput;
      return {
        testCaseId: tc.id,
        input: tc.isHidden ? '[HIDDEN]' : tc.input,
        expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
        actualOutput: tc.isHidden ? '[HIDDEN]' : actualOutput,
        passed: true,
        executionTimeMs: Math.floor(Math.random() * 20) + 10,
        memoryUsageKb: Math.floor(Math.random() * 5000) + 12000,
        errorMsg: null,
      };
    });

    return {
      status: SubmissionStatus.COMPLETED,
      stdout: `[Mock Execution: ${language.toUpperCase()}]\nProgram output: computed successfully.`,
      stderr: null,
      compileError: null,
      executionTimeMs: 35,
      memoryUsageKb: 15420,
      testResults,
      allPassed: true,
    };
  }
}
