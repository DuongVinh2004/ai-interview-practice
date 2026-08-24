import { z } from 'zod';

export const EvalCaseResultSchema = z.object({
  caseId: z.string(),
  locale: z.string(),
  competencyArea: z.string(),
  role: z.string(),
  seniority: z.string(),
  score: z.number(),
  expectedMin: z.number(),
  expectedMax: z.number(),
  isScoreWithinInterval: z.boolean(),
  evidenceFound: z.array(z.string()),
  missingEvidenceTerms: z.array(z.string()),
  isSafetyPassed: z.boolean(),
  latencyMs: z.number(),
  status: z.enum(['PASSED', 'FAILED']),
  failureReason: z.string().optional(),
});

export type EvalCaseResult = z.infer<typeof EvalCaseResultSchema>;

export const EvalSliceMetricSchema = z.object({
  sliceKey: z.string(),
  sliceCategory: z.enum(['LOCALE', 'COMPETENCY', 'SENIORITY', 'SAFETY']),
  totalCases: z.number(),
  passedCases: z.number(),
  adherencePercentage: z.number(),
  avgScore: z.number(),
  avgLatencyMs: z.number(),
});

export type EvalSliceMetric = z.infer<typeof EvalSliceMetricSchema>;

export const QualityGateSummarySchema = z.object({
  passed: z.boolean(),
  scoreIntervalAdherence: z.number(), // percentage 0-100
  evidencePrecision: z.number(), // percentage 0-100
  safetyPassRate: z.number(), // percentage 0-100
  p50LatencyMs: z.number(),
  p95LatencyMs: z.number(),
  totalCases: z.number(),
  passedCases: z.number(),
  failedCases: z.number(),
  gateFailures: z.array(z.string()),
});

export type QualityGateSummary = z.infer<typeof QualityGateSummarySchema>;

export const EvalHarnessReportSchema = z.object({
  runId: z.string(),
  timestamp: z.string(),
  datasetVersion: z.string(),
  datasetId: z.string(),
  qualityGate: QualityGateSummarySchema,
  sliceMetrics: z.array(EvalSliceMetricSchema),
  caseResults: z.array(EvalCaseResultSchema),
});

export type EvalHarnessReport = z.infer<typeof EvalHarnessReportSchema>;
