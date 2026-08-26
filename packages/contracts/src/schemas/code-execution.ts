import { z } from 'zod';
import { SubmissionStatus } from '../enums';

export const SupportedCodeLanguageSchema = z.enum([
  'javascript',
  'typescript',
  'python',
  'java',
  'go',
  'cpp',
]);
export type SupportedCodeLanguage = z.infer<typeof SupportedCodeLanguageSchema>;

export const TestCaseSchema = z.object({
  id: z.string().uuid().optional(),
  input: z.string().max(10000),
  expectedOutput: z.string().max(10000),
  isHidden: z.boolean().default(false),
  order: z.number().int().default(0),
});
export type TestCaseDto = z.infer<typeof TestCaseSchema>;

export const ExecuteCodeRequestSchema = z.object({
  language: SupportedCodeLanguageSchema,
  sourceCode: z.string().min(1, 'Source code cannot be empty').max(50000),
  customInput: z.string().max(10000).optional(),
  testCases: z.array(TestCaseSchema).max(20).optional(),
});

export type ExecuteCodeRequest = z.infer<typeof ExecuteCodeRequestSchema>;

export const TestCaseExecutionResultSchema = z.object({
  testCaseId: z.string().optional(),
  input: z.string(),
  expectedOutput: z.string(),
  actualOutput: z.string().nullable().optional(),
  passed: z.boolean(),
  errorMsg: z.string().nullable().optional(),
  executionTimeMs: z.number().nullable().optional(),
  memoryUsageKb: z.number().nullable().optional(),
});
export type TestCaseExecutionResult = z.infer<typeof TestCaseExecutionResultSchema>;

export const ExecuteCodeResponseSchema = z.object({
  status: z.nativeEnum(SubmissionStatus),
  stdout: z.string().nullable().optional(),
  stderr: z.string().nullable().optional(),
  executionTimeMs: z.number().nullable().optional(),
  memoryUsageKb: z.number().nullable().optional(),
  compileError: z.string().nullable().optional(),
  testResults: z.array(TestCaseExecutionResultSchema).default([]),
  allPassed: z.boolean(),
});
export type ExecuteCodeResponse = z.infer<typeof ExecuteCodeResponseSchema>;

export const SubmitCodeRequestSchema = z.object({
  turnNumber: z.number().int().min(1).max(10),
  language: SupportedCodeLanguageSchema,
  sourceCode: z.string().min(1).max(50000),
});
export type SubmitCodeRequest = z.infer<typeof SubmitCodeRequestSchema>;

export const AiCodeReviewSchema = z.object({
  timeComplexity: z.string(), // e.g. "O(n)"
  spaceComplexity: z.string(), // e.g. "O(1)"
  complexityAnalysis: z.string(),
  codeQualityScore: z.number().min(0).max(10),
  cleanCodeFeedback: z.array(z.string()),
  edgeCasesIdentified: z.array(z.string()),
  optimizedSolutionSnippet: z.string().optional(),
});
export type AiCodeReview = z.infer<typeof AiCodeReviewSchema>;

export const CodeSubmissionResponseSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  turnNumber: z.number().int(),
  language: SupportedCodeLanguageSchema,
  sourceCode: z.string(),
  status: z.nativeEnum(SubmissionStatus),
  timeComplexity: z.string().nullable().optional(),
  spaceComplexity: z.string().nullable().optional(),
  aiFeedback: z.string().nullable().optional(),
  aiReview: AiCodeReviewSchema.nullable().optional(),
  executionTimeMs: z.number().nullable().optional(),
  memoryUsageKb: z.number().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type CodeSubmissionResponse = z.infer<typeof CodeSubmissionResponseSchema>;
