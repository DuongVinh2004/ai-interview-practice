# AI provider incident runbook

## Triggers

Elevated timeout/error/schema-repair rate, unsafe/leaking output, unexpected model behavior/version, region/privacy concern, credential compromise, spend anomaly, or provider outage.

## Immediate response

1. Open incident and capture provider/model/prompt/rubric versions, time window, request IDs and safe samples.
2. Disable affected route/model with the circuit breaker; preserve answer persistence and show honest delayed/degraded status.
3. Stop automatic retries that amplify cost or harm; cap queue intake and protect core services.
4. Revoke/rotate credentials for suspected compromise and restrict egress.
5. Preserve restricted evidence; do not paste private answers into broad channels.

## Recovery

Validate provider status and contract, replay a bounded sanitized golden/adversarial suite, compare quality/safety/cost/latency, then canary a small cohort. Reconcile queued jobs using idempotency keys. Notify users if results were delayed, wrong, or exposed according to approved response policy.

## Fallback

Fallback must be pre-evaluated. Otherwise use deterministic practice guidance or delayed evaluation, never an untested model. Re-evaluation creates a linked result and preserves the original audit trail.
