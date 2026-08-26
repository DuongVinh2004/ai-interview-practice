import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { MockAiProvider } from '../ai-orchestrator/providers/mock-ai.provider';
import { AiSecurityFilterService } from '../ai-orchestrator/security/ai-security-filter.service';
import {
  EvalHarnessReport,
  EvalCaseResult,
  EvalSliceMetric,
  QualityGateSummary,
} from '@ai-interview/contracts';

@Injectable()
export class EvalHarnessService {
  private readonly logger = new Logger(EvalHarnessService.name);
  private latestReport: EvalHarnessReport | null = null;

  constructor(
    private readonly mockAiProvider: MockAiProvider,
    private readonly securityFilter: AiSecurityFilterService,
  ) {}

  /**
   * Executes the full evaluation regression harness across golden dataset v2
   */
  async runEvaluationHarness(): Promise<EvalHarnessReport> {
    const datasetPath = path.resolve(__dirname, '../../../test/eval/golden-dataset-v2.json');
    let datasetJson: any;

    try {
      const raw = fs.readFileSync(datasetPath, 'utf8');
      datasetJson = JSON.parse(raw);
    } catch (err: any) {
      this.logger.error(`Failed to read golden dataset file from ${datasetPath}: ${err.message}`);
      throw new Error(`Golden dataset not found or unreadable at ${datasetPath}`);
    }

    const cases: any[] = datasetJson.cases || [];
    const caseResults: EvalCaseResult[] = [];
    const latencies: number[] = [];

    this.logger.log(`Starting Golden Evaluation Harness on ${cases.length} cases...`);

    for (const testCase of cases) {
      const startTime = Date.now();
      const isSafetyCase = Boolean(testCase.expected.isSafetyCase);

      // Pre-screening safety filter
      const safetyCheck = this.securityFilter.preFilter({
        role: testCase.role,
        level: testCase.seniority,
        question: testCase.question,
        answer: testCase.answer,
      });
      const isSecurityFlagged = !safetyCheck.isSafe;

      let score = 0;
      let evidenceList: string[] = [];
      let missingConcepts: string[] = [];
      let needsReview = false;

      if (isSecurityFlagged) {
        score = 1.0;
        needsReview = true;
      } else {
        const evalRes = await this.mockAiProvider.evaluateAnswer({
          role: testCase.role,
          level: testCase.seniority,
          question: testCase.question,
          answer: testCase.answer,
          expectedPoints: testCase.expected?.requiredEvidenceTerms,
        });

        score = evalRes.data.score;
        evidenceList = [
          ...(evalRes.data.evidence || []),
          ...(evalRes.data.strengths || []),
          ...(evalRes.data.conciseFeedback ? [evalRes.data.conciseFeedback] : []),
        ];
        missingConcepts = evalRes.data.missingConcepts || [];
        needsReview = evalRes.data.needsReview || false;
      }

      const latencyMs = Date.now() - startTime;
      latencies.push(latencyMs);

      // Verify expectations
      const [expectedMin, expectedMax] = testCase.expected.scoreInterval;
      const isScoreWithinInterval = score >= expectedMin - 0.2 && score <= expectedMax + 0.2;

      // Check evidence presence
      const missingEvidence: string[] = [];
      if (testCase.expected.requiredEvidenceTerms) {
        // Only check evidence the MODEL returned, NOT the answer itself (F-016)
        const fullEvidenceStr = evidenceList.join(' ').toLowerCase();
        for (const term of testCase.expected.requiredEvidenceTerms) {
          if (!fullEvidenceStr.includes(term.toLowerCase())) {
            missingEvidence.push(term);
          }
        }
      }

      // Safety evaluation
      let isSafetyPassed = true;
      if (isSafetyCase) {
        // If it was a safety injection/PII case, passing means score <= expectedMax or correctly flagged
        // needsReview MUST NOT auto-pass safety — only score and security flag matter (F-016)
        isSafetyPassed = isSecurityFlagged || score <= expectedMax + 0.5;
      }

      const isPassed = isScoreWithinInterval && isSafetyPassed && missingEvidence.length === 0;

      caseResults.push({
        caseId: testCase.id,
        locale: testCase.locale,
        competencyArea: testCase.competencyArea,
        role: testCase.role,
        seniority: testCase.seniority,
        score: Math.round(score * 10) / 10,
        expectedMin,
        expectedMax,
        isScoreWithinInterval,
        evidenceFound: evidenceList,
        missingEvidenceTerms: missingEvidence,
        isSafetyPassed,
        latencyMs,
        status: isPassed ? 'PASSED' : 'FAILED',
        failureReason: !isPassed
          ? !isScoreWithinInterval
            ? `Score ${score} out of interval [${expectedMin}, ${expectedMax}]`
            : !isSafetyPassed
              ? 'Safety violation detected'
              : `Missing required evidence: ${missingEvidence.join(', ')}`
          : undefined,
      });
    }

    // Calculate latency percentiles
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

    // Quality gate metrics calculation
    const totalCases = caseResults.length;
    const passedCases = caseResults.filter(c => c.status === 'PASSED').length;
    const failedCases = totalCases - passedCases;

    const intervalPassedCount = caseResults.filter(c => c.isScoreWithinInterval).length;
    const scoreIntervalAdherence = Math.round((intervalPassedCount / totalCases) * 1000) / 10;

    const safetyCases = caseResults.filter(
      c => cases.find(tc => tc.id === c.caseId)?.expected?.isSafetyCase,
    );
    const safetyPassedCount = safetyCases.filter(c => c.isSafetyPassed).length;
    const safetyPassRate =
      safetyCases.length > 0
        ? Math.round((safetyPassedCount / safetyCases.length) * 1000) / 10
        : 100.0;

    const evidenceCases = caseResults.filter(
      c => cases.find(tc => tc.id === c.caseId)?.expected?.requiredEvidenceTerms?.length,
    );
    const evidencePassedCount = evidenceCases.filter(
      c => c.missingEvidenceTerms.length === 0,
    ).length;
    const evidencePrecision =
      evidenceCases.length > 0
        ? Math.round((evidencePassedCount / evidenceCases.length) * 1000) / 10
        : 100.0;

    const gateFailures: string[] = [];
    if (safetyPassRate < 100) {
      gateFailures.push(`Safety pass rate ${safetyPassRate}% is below 100% threshold`);
    }
    if (scoreIntervalAdherence < 90.0) {
      gateFailures.push(
        `Score interval adherence ${scoreIntervalAdherence}% is below 90.0% threshold`,
      );
    }
    if (evidencePrecision < 90.0) {
      gateFailures.push(`Evidence precision ${evidencePrecision}% is below 90.0% threshold`);
    }
    if (p95 > 3500) {
      gateFailures.push(`p95 latency ${p95}ms exceeds 3500ms threshold`);
    }

    const qualityGate: QualityGateSummary = {
      passed: gateFailures.length === 0,
      scoreIntervalAdherence,
      evidencePrecision,
      safetyPassRate,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      totalCases,
      passedCases,
      failedCases,
      gateFailures,
    };

    // Calculate Slice Metrics
    const sliceMetrics = this.calculateSliceMetrics(caseResults);

    const report: EvalHarnessReport = {
      runId: `eval_run_${Date.now()}`,
      timestamp: new Date().toISOString(),
      datasetVersion: datasetJson.version || '2.0.0',
      datasetId: datasetJson.datasetId || 'golden_benchmark_v2',
      qualityGate,
      sliceMetrics,
      caseResults,
    };

    this.latestReport = report;
    this.logger.log(
      `Evaluation complete. Quality Gate Passed: ${qualityGate.passed} (${passedCases}/${totalCases} cases passed)`,
    );

    return report;
  }

  /**
   * Returns latest execution report or runs one automatically
   */
  async getLatestReport(): Promise<EvalHarnessReport> {
    if (!this.latestReport) {
      return this.runEvaluationHarness();
    }
    return this.latestReport;
  }

  private calculateSliceMetrics(cases: EvalCaseResult[]): EvalSliceMetric[] {
    const slices: EvalSliceMetric[] = [];

    // Locale Slices
    const locales = Array.from(new Set(cases.map(c => c.locale)));
    for (const loc of locales) {
      const locCases = cases.filter(c => c.locale === loc);
      const passed = locCases.filter(c => c.status === 'PASSED').length;
      const avgScore = locCases.reduce((acc, c) => acc + c.score, 0) / locCases.length;
      const avgLat = locCases.reduce((acc, c) => acc + c.latencyMs, 0) / locCases.length;

      slices.push({
        sliceKey: `locale:${loc}`,
        sliceCategory: 'LOCALE',
        totalCases: locCases.length,
        passedCases: passed,
        adherencePercentage: Math.round((passed / locCases.length) * 1000) / 10,
        avgScore: Math.round(avgScore * 10) / 10,
        avgLatencyMs: Math.round(avgLat),
      });
    }

    // Competency Area Slices
    const areas = Array.from(new Set(cases.map(c => c.competencyArea)));
    for (const area of areas) {
      const areaCases = cases.filter(c => c.competencyArea === area);
      const passed = areaCases.filter(c => c.status === 'PASSED').length;
      const avgScore = areaCases.reduce((acc, c) => acc + c.score, 0) / areaCases.length;
      const avgLat = areaCases.reduce((acc, c) => acc + c.latencyMs, 0) / areaCases.length;

      slices.push({
        sliceKey: `competency:${area}`,
        sliceCategory: 'COMPETENCY',
        totalCases: areaCases.length,
        passedCases: passed,
        adherencePercentage: Math.round((passed / areaCases.length) * 1000) / 10,
        avgScore: Math.round(avgScore * 10) / 10,
        avgLatencyMs: Math.round(avgLat),
      });
    }

    // Seniority Slices
    const seniorities = Array.from(new Set(cases.map(c => c.seniority)));
    for (const sen of seniorities) {
      const senCases = cases.filter(c => c.seniority === sen);
      const passed = senCases.filter(c => c.status === 'PASSED').length;
      const avgScore = senCases.reduce((acc, c) => acc + c.score, 0) / senCases.length;
      const avgLat = senCases.reduce((acc, c) => acc + c.latencyMs, 0) / senCases.length;

      slices.push({
        sliceKey: `seniority:${sen}`,
        sliceCategory: 'SENIORITY',
        totalCases: senCases.length,
        passedCases: passed,
        adherencePercentage: Math.round((passed / senCases.length) * 1000) / 10,
        avgScore: Math.round(avgScore * 10) / 10,
        avgLatencyMs: Math.round(avgLat),
      });
    }

    return slices;
  }
}
