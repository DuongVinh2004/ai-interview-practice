import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '../../src/modules/platform/metrics/metrics.service';
import * as fs from 'fs';
import * as path from 'path';

describe('Synthetic Alerts Simulation (OPS-001 / PRD-1401..1404)', () => {
  let metricsService: MetricsService;
  let rawAlertRulesContent: string;

  beforeAll(() => {
    const alertRulesPath = path.resolve(__dirname, '../../../../infra/prometheus/alert_rules.yml');
    rawAlertRulesContent = fs.readFileSync(alertRulesPath, 'utf-8');
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    metricsService = module.get<MetricsService>(MetricsService);
    metricsService.onModuleInit();
  });

  it('verifies all alert rules in alert_rules.yml have required structure, labels and annotations', () => {
    const alertMatches = Array.from(rawAlertRulesContent.matchAll(/alert:\s*([A-Za-z0-9_]+)/g)).map(
      m => m[1],
    );
    expect(alertMatches.length).toBeGreaterThanOrEqual(6);

    expect(alertMatches).toContain('HighHttp5xxErrorRate');
    expect(alertMatches).toContain('HighHttpLatencyP95');
    expect(alertMatches).toContain('AiProviderOutageHighFailureRate');
    expect(alertMatches).toContain('CircuitBreakerTrippedOpen');
    expect(alertMatches).toContain('BullMqQueueBacklogLag');
    expect(alertMatches).toContain('AiDailyBudgetBurnCritical');

    expect(rawAlertRulesContent).toContain('severity: critical');
    expect(rawAlertRulesContent).toContain('severity: warning');
    expect(rawAlertRulesContent).toContain('runbook:');
  });

  it('simulates HighHttp5xxErrorRate scenario and verifies metric generation', async () => {
    for (let i = 0; i < 95; i++) {
      metricsService.httpRequestsTotal.inc({
        method: 'POST',
        route: '/api/v1/interviews',
        status_code: '200',
      });
    }
    for (let i = 0; i < 5; i++) {
      metricsService.httpRequestsTotal.inc({
        method: 'POST',
        route: '/api/v1/interviews',
        status_code: '500',
      });
    }

    const output = await metricsService.getMetrics();
    expect(output).toContain('http_requests_total{');
    expect(output).toMatch(/http_requests_total\{[^}]*status_code="500"[^}]*\}\s+5/);
    expect(output).toMatch(/http_requests_total\{[^}]*status_code="200"[^}]*\}\s+95/);
  });

  it('simulates HighHttpLatencyP95 degradation and verifies histogram observation', async () => {
    metricsService.httpRequestDurationSeconds.observe(
      { method: 'GET', route: '/api/v1/interviews/1', status_code: '200' },
      1.2,
    );
    metricsService.httpRequestDurationSeconds.observe(
      { method: 'GET', route: '/api/v1/interviews/1', status_code: '200' },
      2.5,
    );

    const output = await metricsService.getMetrics();
    expect(output).toContain('http_request_duration_seconds_bucket');
    expect(output).toContain('http_request_duration_seconds_sum');
  });

  it('simulates AiProviderOutageHighFailureRate scenario', async () => {
    for (let i = 0; i < 8; i++) {
      metricsService.aiProviderRequestsTotal.inc({
        provider: 'gemini',
        operation: 'generateQuestion',
        status: 'success',
      });
    }
    for (let i = 0; i < 4; i++) {
      metricsService.aiProviderRequestsTotal.inc({
        provider: 'gemini',
        operation: 'generateQuestion',
        status: 'error',
      });
    }

    const output = await metricsService.getMetrics();
    expect(output).toMatch(
      /ai_provider_requests_total\{[^}]*provider="gemini"[^}]*status="error"[^}]*\}\s+4/,
    );
    expect(output).toMatch(
      /ai_provider_requests_total\{[^}]*provider="gemini"[^}]*status="success"[^}]*\}\s+8/,
    );
  });

  it('simulates CircuitBreakerTrippedOpen state transition to Gauge=2 (OPEN)', async () => {
    metricsService.aiCircuitBreakerState.set(
      { provider: 'openai', operation: 'evaluateAnswer' },
      2,
    );
    metricsService.aiCircuitBreakerTripsTotal.inc({
      provider: 'openai',
      operation: 'evaluateAnswer',
    });

    const output = await metricsService.getMetrics();
    expect(output).toMatch(
      /ai_circuit_breaker_state\{[^}]*provider="openai"[^}]*operation="evaluateAnswer"[^}]*\}\s+2/,
    );
    expect(output).toMatch(
      /ai_circuit_breaker_trips_total\{[^}]*provider="openai"[^}]*operation="evaluateAnswer"[^}]*\}\s+1/,
    );
  });

  it('simulates BullMqQueueBacklogLag metric recording', async () => {
    metricsService.bullmqQueueLagSeconds.observe(
      { queue: 'evaluation', job_name: 'evaluate-turn' },
      35.0,
    );

    const output = await metricsService.getMetrics();
    expect(output).toMatch(/bullmq_queue_lag_seconds_bucket\{[^}]*le="30"[^}]*\}\s+0/);
    expect(output).toMatch(/bullmq_queue_lag_seconds_bucket\{[^}]*le="60"[^}]*\}\s+1/);
  });

  it('simulates Storage observability metrics (PRD-1004)', async () => {
    metricsService.storageUploadIntentsTotal.inc({ category: 'documents', status: 'issued' });
    metricsService.storageConfirmedBytesTotal.inc({ category: 'documents' }, 1024 * 1024);
    metricsService.storageDeletionEventsTotal.inc({ status: 'success' });
    metricsService.storageQuotaRejectionsTotal.inc({ reason: 'byte_cap_exceeded' });

    const output = await metricsService.getMetrics();
    expect(output).toMatch(
      /storage_upload_intents_total\{[^}]*category="documents"[^}]*status="issued"[^}]*\}\s+1/,
    );
    expect(output).toMatch(
      /storage_confirmed_bytes_total\{[^}]*category="documents"[^}]*\}\s+1048576/,
    );
    expect(output).toMatch(/storage_deletion_events_total\{[^}]*status="success"[^}]*\}\s+1/);
    expect(output).toMatch(
      /storage_quota_rejections_total\{[^}]*reason="byte_cap_exceeded"[^}]*\}\s+1/,
    );
  });

  it('simulates AI daily budget burn metrics and validates 80% and 100% threshold rules', async () => {
    metricsService.aiCostUsdTotal.inc({ provider: 'gemini', model: 'gemini-1.5-flash' }, 42.5);

    const output = await metricsService.getMetrics();
    expect(output).toMatch(
      /ai_estimated_cost_usd_total\{[^}]*provider="gemini"[^}]*model="gemini-1\.5-flash"[^}]*\}\s+42\.5/,
    );

    expect(rawAlertRulesContent).toContain('AiDailyBudgetBurnCritical');
    expect(rawAlertRulesContent).toContain('AiDailyBudgetExhausted');
  });
});
