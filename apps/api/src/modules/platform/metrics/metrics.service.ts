import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: client.Registry;

  // HTTP Metrics
  public readonly httpRequestsTotal: client.Counter<string>;
  public readonly httpRequestDurationSeconds: client.Histogram<string>;
  public readonly httpActiveRequests: client.Gauge<string>;

  // Queue & Worker Metrics
  public readonly bullmqJobsTotal: client.Counter<string>;
  public readonly bullmqJobDurationSeconds: client.Histogram<string>;
  public readonly bullmqQueueLagSeconds: client.Histogram<string>;

  // AI & Circuit Breaker Metrics
  public readonly aiTokensTotal: client.Counter<string>;
  public readonly aiCostUsdTotal: client.Counter<string>;
  public readonly aiProviderRequestsTotal: client.Counter<string>;
  public readonly aiProviderLatencySeconds: client.Histogram<string>;
  public readonly aiCircuitBreakerState: client.Gauge<string>;
  public readonly aiCircuitBreakerTripsTotal: client.Counter<string>;

  // Evaluation & Business Metrics
  public readonly evaluationsTotal: client.Counter<string>;
  public readonly evaluationScoreDistribution: client.Histogram<string>;
  public readonly evaluationNeedsReviewTotal: client.Counter<string>;

  // Storage & Deletion Observability Metrics (PRD-1004)
  public readonly storageUploadIntentsTotal: client.Counter<string>;
  public readonly storageConfirmedBytesTotal: client.Counter<string>;
  public readonly storageDeletionEventsTotal: client.Counter<string>;
  public readonly storageQuotaRejectionsTotal: client.Counter<string>;

  constructor() {
    this.registry = new client.Registry();
    this.registry.setDefaultLabels({
      app: 'ai-interview-practice',
      env: process.env.NODE_ENV || 'development',
    });

    // Default Node.js process / memory / CPU metrics
    client.collectDefaultMetrics({ register: this.registry });

    // HTTP Metrics
    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests processed',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.3, 0.5, 0.8, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpActiveRequests = new client.Gauge({
      name: 'http_active_requests',
      help: 'Number of active HTTP requests currently being processed',
      labelNames: ['method'],
      registers: [this.registry],
    });

    // BullMQ Queue Metrics
    this.bullmqJobsTotal = new client.Counter({
      name: 'bullmq_jobs_total',
      help: 'Total BullMQ jobs processed',
      labelNames: ['queue', 'job_name', 'status'],
      registers: [this.registry],
    });

    this.bullmqJobDurationSeconds = new client.Histogram({
      name: 'bullmq_job_duration_seconds',
      help: 'Execution duration of background BullMQ jobs in seconds',
      labelNames: ['queue', 'job_name'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.registry],
    });

    this.bullmqQueueLagSeconds = new client.Histogram({
      name: 'bullmq_queue_lag_seconds',
      help: 'Waiting time in queue before job processing begins',
      labelNames: ['queue', 'job_name'],
      buckets: [0.1, 0.5, 1, 2, 5, 15, 30, 60],
      registers: [this.registry],
    });

    // AI & Circuit Breaker Metrics
    this.aiTokensTotal = new client.Counter({
      name: 'ai_tokens_total',
      help: 'Total tokens consumed by AI provider calls',
      labelNames: ['provider', 'model', 'token_type'],
      registers: [this.registry],
    });

    this.aiCostUsdTotal = new client.Counter({
      name: 'ai_estimated_cost_usd_total',
      help: 'Estimated cost in USD for external AI provider API calls',
      labelNames: ['provider', 'model'],
      registers: [this.registry],
    });

    this.aiProviderRequestsTotal = new client.Counter({
      name: 'ai_provider_requests_total',
      help: 'Total requests dispatched to AI providers',
      labelNames: ['provider', 'operation', 'status'],
      registers: [this.registry],
    });

    this.aiProviderLatencySeconds = new client.Histogram({
      name: 'ai_provider_latency_seconds',
      help: 'Latency of AI provider API calls in seconds',
      labelNames: ['provider', 'operation'],
      buckets: [0.2, 0.5, 1, 2, 5, 10, 20, 45],
      registers: [this.registry],
    });

    this.aiCircuitBreakerState = new client.Gauge({
      name: 'ai_circuit_breaker_state',
      help: 'Circuit breaker state per provider and operation (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
      labelNames: ['provider', 'operation'],
      registers: [this.registry],
    });

    this.aiCircuitBreakerTripsTotal = new client.Counter({
      name: 'ai_circuit_breaker_trips_total',
      help: 'Number of times circuit breaker transitioned to OPEN',
      labelNames: ['provider', 'operation'],
      registers: [this.registry],
    });

    // Business & Evaluation Metrics
    this.evaluationsTotal = new client.Counter({
      name: 'interview_evaluations_total',
      help: 'Total interview turn evaluations completed',
      labelNames: ['role', 'level', 'pass_fail'],
      registers: [this.registry],
    });

    this.evaluationScoreDistribution = new client.Histogram({
      name: 'interview_evaluation_score_distribution',
      help: 'Distribution of evaluation scores (0 to 10 scale)',
      labelNames: ['role', 'level'],
      buckets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      registers: [this.registry],
    });

    this.evaluationNeedsReviewTotal = new client.Counter({
      name: 'interview_evaluation_needs_review_total',
      help: 'Total evaluations flagged for human review due to fallback or anomalies',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    // Storage & Deletion Observability Metrics (PRD-1004)
    this.storageUploadIntentsTotal = new client.Counter({
      name: 'storage_upload_intents_total',
      help: 'Total upload intents issued, confirmed, or rejected',
      labelNames: ['category', 'status'],
      registers: [this.registry],
    });

    this.storageConfirmedBytesTotal = new client.Counter({
      name: 'storage_confirmed_bytes_total',
      help: 'Total confirmed upload bytes by category',
      labelNames: ['category'],
      registers: [this.registry],
    });

    this.storageDeletionEventsTotal = new client.Counter({
      name: 'storage_deletion_events_total',
      help: 'Total storage deletion events processed',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.storageQuotaRejectionsTotal = new client.Counter({
      name: 'storage_quota_rejections_total',
      help: 'Total storage quota or limit rejections',
      labelNames: ['reason'],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    // Initial state setup for known providers
    const providers = ['gemini', 'openai', 'anthropic', 'mock'];
    const operations = ['generateQuestion', 'evaluateAnswer', 'generateLearningPath'];
    for (const provider of providers) {
      for (const op of operations) {
        this.aiCircuitBreakerState.set({ provider, operation: op }, 0);
      }
    }
  }

  getRegistry(): client.Registry {
    return this.registry;
  }

  async getMetricsContentType(): Promise<string> {
    return this.registry.contentType;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
