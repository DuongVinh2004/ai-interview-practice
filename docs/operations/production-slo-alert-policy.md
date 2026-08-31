# Production SLI/SLO and Alerting Policy

- **Primary Owner:** SRE Owner (Duong Vinh)
- **Consulted:** Application & Platform Owner (Duong Vinh)
- **Status:** APPROVED (PRD-1402 / DEC-010)
- **Last Reviewed:** 2026-09-01
- **Review Cadence:** Quarterly

---

## 1. Service Level Indicators & Objectives (SLI/SLO)

| Service Area | Indicator (SLI) | Target Objective (SLO - 30d Window) | Measurement Method |
|--------------|-----------------|--------------------------------------|--------------------|
| **Core API Availability** | Successful non-5xx responses on critical user journeys (Auth, Sessions, Feedback, Payments) | **>= 99.9%** availability | sum(rate(http_requests_total{status_code!~"5.."}[5m])) / sum(rate(http_requests_total[5m])) |
| **API Latency (p95)** | Round-trip request processing latency excluding streaming | **p95 < 500 ms** | Prometheus histogram quantile on http_request_duration_seconds |
| **API Latency (p99)** | Round-trip request processing latency excluding streaming | **p99 < 1500 ms** | Prometheus histogram quantile on http_request_duration_seconds |
| **Error Rate** | Proportion of HTTP 5xx responses across all routes | **< 0.1%** of total traffic | ate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m]) |
| **Worker Queue Processing** | Time elapsed between job enqueue and execution completion | **Queue lag < 15s**, **Oldest job < 60s** | BullMQ queue metrics ullmq_queue_lag_seconds |
| **AI Provider Availability** | Successful responses from AI provider fallback cascade | **>= 99.5%** logical success | sum(rate(ai_provider_requests_total{status="success"}[5m])) / sum(rate(ai_provider_requests_total[5m])) |
| **AI Daily Budget Compliance** | External API spend within authorized daily budget cap | **100%** within $AI_BUDGET_DAILY_USD | Distributed budget ledger & i_estimated_cost_usd_total |
| **Storage & Upload Reliability** | Valid single-use intent confirmation without unhandled failures | **>= 99.9%** valid confirmations | storage_upload_intents_total and provider metrics |
| **Database Reliability** | PostgreSQL connection pool saturation and query latency | **Pool saturation < 80%**, **p95 query < 50ms** | CloudWatch RDS metrics |

---

## 2. Alert Escalation Matrix & Runbooks

| Alert Name | Severity | Condition / Threshold | Routing / Destination | Actionable Runbook |
|------------|----------|-----------------------|-----------------------|--------------------|
| ApiErrorRateHigh | Critical | HTTP 5xx rate > 1% for 5m | On-call SRE / PagerDuty | Check ECS tasks logs, recent deployment, database connectivity |
| ApiLatencyP95Breached | Warning | API p95 latency > 500ms for 10m | SRE Team Slack | Inspect slow database queries, external AI provider latency |
| AiCircuitBreakerOpen | Warning | Provider circuit trips to OPEN | Engineering Slack | Verify provider status page, API keys, fallback provider health |
| AiDailyBudgetWarning | Warning | Accumulated AI spend >= 80% daily cap | Product & SRE Slack | Review traffic volume, adjust rate limits or budget allocation |
| AiDailyBudgetCritical | Critical | Accumulated AI spend >= 100% daily cap | On-call SRE / PagerDuty | System operating in zero-cost mock/fallback mode; review spend |
| WorkerQueueLagging | Warning | Queue lag > 30s for 5m | Backend Team Slack | Check worker container health, scale up worker ECS task count |
| StorageDeletionDeadLetter | Warning | Storage deletion pending > 15m | Platform / Data Owner | Run reconciliation script, verify cloud provider IAM permissions |
| RedisMemoryHigh | Critical | Redis memory usage > 85% | Platform / SRE | Inspect key TTLs, evictions, scale ElastiCache node class |
| DatabaseStorageLow | Critical | RDS free storage < 15% | Database Owner / SRE | Trigger storage autoscaling or clean archive partitions |

---

## 3. Review Governance

- Metrics and thresholds are validated as part of deployment gates.
- Synthetic firing tests must be conducted during staging validation drills.
- Post-incident reviews must audit SLO error budget consumption and update thresholds accordingly.
