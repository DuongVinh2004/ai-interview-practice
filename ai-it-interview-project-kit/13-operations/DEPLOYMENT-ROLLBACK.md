# Deployment and rollback runbook

## Preflight

Confirm approved artifact digest, release record, change window, on-call, SLO budget, backup/restore status, secrets/config validation, compatible migration, feature flags, capacity, provider/quota status, and rollback owner.

## Sequence

1. Apply additive/backward-compatible infrastructure and schema changes.
2. Deploy canary API/worker with new consumers disabled where appropriate.
3. Run smoke, ownership, migration, queue, telemetry and degraded-provider checks.
4. Increase traffic progressively while observing SLOs, saturation, business invariants and cost.
5. Enable features by cohort; record final digest/config.
6. Contract old schema/API only in a later release after usage evidence.

## Automatic rollback signals

Rapid error-budget burn, answer loss/duplication, authorization anomaly, migration error, crash loop, material queue growth, or critical AI safety failure. Pause rather than blindly roll back when the database has an irreversible state change.

## Rollback

Disable feature/provider route, drain or pause compatible jobs, restore previous artifact digest, validate schema compatibility, run smoke/invariant checks, and communicate. Data restore is a separate incident procedure and requires exact recovery-point approval.
