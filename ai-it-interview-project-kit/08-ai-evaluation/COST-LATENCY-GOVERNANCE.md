# AI cost and latency governance

## Budgets

Define budgets per operation and subscription plan: generated questions, evaluated answers, explanation retries, and learning-plan generation. Track input/output tokens, cached tokens, provider request ID, latency, retries, outcome, estimated cost, tenant/user pseudonymous ID, and artifact versions.

## Runtime controls

- Enforce per-user and global rate limits, concurrency limits, monthly quotas, payload limits, and maximum output tokens.
- Use bounded retries with jitter only for safe transient failures; never retry a non-idempotent charge blindly.
- Cache only non-personal, version-addressed content such as approved question metadata.
- Shed optional work before core session persistence.
- Use circuit breakers and a deterministic degraded mode for provider incidents.

## Targets and alerts

Application persistence and acknowledgement must not wait indefinitely for an AI provider. Initial targets are documented in the SLO file and baselined with load tests. Alert on spend anomaly, token growth, repair/retry rate, provider error rate, p95 latency, queue age, and quota bypass.

## Review

Weekly engineering review covers unit economics and anomalies; monthly product review covers cost per completed interview and quality tradeoffs. Any routing optimization must pass the same quality and safety gates as the primary route.
