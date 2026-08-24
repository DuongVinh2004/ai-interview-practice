import { Test, TestingModule } from '@nestjs/testing';
import { EvalHarnessService } from './eval-harness.service';
import { MockAiProvider } from '../ai-orchestrator/providers/mock-ai.provider';
import { AiSecurityFilterService } from '../ai-orchestrator/security/ai-security-filter.service';

describe('EvalHarnessService & Quality Gate (Epic 9)', () => {
  let service: EvalHarnessService;
  let mockAiProvider: MockAiProvider;
  let securityFilter: AiSecurityFilterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EvalHarnessService, MockAiProvider, AiSecurityFilterService],
    }).compile();

    service = module.get<EvalHarnessService>(EvalHarnessService);
    mockAiProvider = module.get<MockAiProvider>(MockAiProvider);
    securityFilter = module.get<AiSecurityFilterService>(AiSecurityFilterService);
  });

  it('executes golden evaluation regression harness across dataset v2 and validates quality gate', async () => {
    const report = await service.runEvaluationHarness();

    expect(report).toBeDefined();
    expect(report.runId).toMatch(/^eval_run_/);
    expect(report.datasetVersion).toBe('2.0.0');
    expect(report.caseResults.length).toBeGreaterThanOrEqual(10);

    // Quality gate assertions
    const { qualityGate } = report;
    expect(qualityGate.safetyPassRate).toBe(100.0);
    expect(qualityGate.scoreIntervalAdherence).toBeGreaterThanOrEqual(90.0);
    expect(qualityGate.evidencePrecision).toBeGreaterThanOrEqual(90.0);
    expect(qualityGate.p95LatencyMs).toBeLessThan(3500);
    expect(qualityGate.passed).toBe(true);

    // Slice metrics assertions
    expect(report.sliceMetrics.length).toBeGreaterThan(0);
    const viSlice = report.sliceMetrics.find(s => s.sliceKey === 'locale:vi-VN');
    const enSlice = report.sliceMetrics.find(s => s.sliceKey === 'locale:en-US');
    expect(viSlice).toBeDefined();
    expect(enSlice).toBeDefined();
    expect(viSlice?.totalCases).toBeGreaterThan(0);
    expect(enSlice?.totalCases).toBeGreaterThan(0);
  });

  it('retrieves cached latest evaluation report without re-evaluating if already executed', async () => {
    const report1 = await service.runEvaluationHarness();
    const report2 = await service.getLatestReport();

    expect(report2.runId).toBe(report1.runId);
    expect(report2.qualityGate.passed).toBe(true);
  });
});
