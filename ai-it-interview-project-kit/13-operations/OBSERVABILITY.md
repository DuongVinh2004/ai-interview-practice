# Observability specification

## Signals

Use structured logs, RED metrics (rate/errors/duration), USE metrics for resources, distributed traces, business/AI quality events, and auditable security events. Propagate one correlation/trace ID from edge through API, queue job, worker, provider and notification.

## Required dimensions

Environment, service/module, version, route/event/job type, outcome/error code, locale, provider/model/prompt/rubric version, retry count, token/cost band, and pseudonymous user/session ID. Prevent unbounded labels: raw user IDs, questions, answers, stack traces, URLs, and provider messages are not metric labels.

## Privacy and security

Default logs exclude passwords, tokens, cookies, MFA material, provider keys, full prompts/answers, email, and recording content. Central redaction is tested. Access is least privilege and audited; retention follows classification.

## Dashboards

Candidate journey, API/SSE health, database/Redis, BullMQ queues, AI provider/quality/cost, auth/security, releases, quotas, backup/DR, and SLO/error budgets. Each alert links owner, dashboard, runbook and recent deployment.

## Telemetry failure

Telemetry must not break core requests or leak data through fallback logs. Buffer/bound exporters, sample intentionally, expose dropped-telemetry metrics, and test collector outages.
