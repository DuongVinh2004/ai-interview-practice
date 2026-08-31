import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(service.getRegistry()).toBeDefined();
  });

  it('should initialize and increment HTTP metrics', async () => {
    service.httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/sessions', status_code: '200' });
    service.httpRequestDurationSeconds.observe(
      { method: 'GET', route: '/api/v1/sessions', status_code: '200' },
      0.15,
    );

    const metrics = await service.getMetrics();
    expect(metrics).toContain('http_requests_total');
    expect(metrics).toContain('route="/api/v1/sessions"');
    expect(metrics).toContain('status_code="200"');
    expect(metrics).toContain('http_request_duration_seconds_bucket');
  });

  it('should record AI provider token and cost metrics', async () => {
    service.aiTokensTotal.inc({ provider: 'openai', model: 'gpt-4o', token_type: 'prompt' }, 120);
    service.aiCostUsdTotal.inc({ provider: 'openai', model: 'gpt-4o' }, 0.0035);
    service.aiCircuitBreakerState.set({ provider: 'openai', operation: 'evaluateAnswer' }, 0);

    const metrics = await service.getMetrics();
    expect(metrics).toContain('ai_tokens_total');
    expect(metrics).toContain('provider="openai"');
    expect(metrics).toContain('model="gpt-4o"');
    expect(metrics).toContain('token_type="prompt"');
    expect(metrics).toContain('120');
    expect(metrics).toContain('ai_estimated_cost_usd_total');
    expect(metrics).toContain('0.0035');
    expect(metrics).toContain('ai_circuit_breaker_state');
  });

  it('should record BullMQ queue metrics', async () => {
    service.bullmqJobsTotal.inc({
      queue: 'answer-evaluation',
      job_name: 'evaluate_answer',
      status: 'completed',
    });
    service.bullmqJobDurationSeconds.observe(
      { queue: 'answer-evaluation', job_name: 'evaluate_answer' },
      1.2,
    );

    const metrics = await service.getMetrics();
    expect(metrics).toContain('bullmq_jobs_total');
    expect(metrics).toContain('queue="answer-evaluation"');
    expect(metrics).toContain('job_name="evaluate_answer"');
    expect(metrics).toContain('status="completed"');
  });

  it('should record storage and deletion observability metrics (PRD-1004)', async () => {
    service.storageUploadIntentsTotal.inc({ category: 'documents', status: 'issued' });
    service.storageConfirmedBytesTotal.inc({ category: 'documents' }, 102400);
    service.storageDeletionEventsTotal.inc({ status: 'succeeded' });
    service.storageQuotaRejectionsTotal.inc({ reason: 'category_bytes_exceeded' });

    const metrics = await service.getMetrics();
    expect(metrics).toContain('storage_upload_intents_total');
    expect(metrics).toContain('category="documents"');
    expect(metrics).toContain('status="issued"');
    expect(metrics).toContain('storage_confirmed_bytes_total');
    expect(metrics).toContain('storage_deletion_events_total');
    expect(metrics).toContain('status="succeeded"');
    expect(metrics).toContain('storage_quota_rejections_total');
    expect(metrics).toContain('reason="category_bytes_exceeded"');
  });
});
