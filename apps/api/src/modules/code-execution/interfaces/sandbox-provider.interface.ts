import { ExecuteCodeResponse, TestCaseDto } from '@ai-interview/contracts';

export interface SandboxProvider {
  readonly name: string;
  executeCode(
    language: string,
    sourceCode: string,
    testCases?: TestCaseDto[],
    customInput?: string,
    compilerOptions?: string,
  ): Promise<ExecuteCodeResponse>;
}
