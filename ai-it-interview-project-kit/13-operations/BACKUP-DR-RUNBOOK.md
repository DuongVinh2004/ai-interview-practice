# Backup and disaster recovery runbook

## Targets

Initial Tier-1 target: PostgreSQL RPO ≤ 15 minutes and RTO ≤ 60 minutes; configuration/object artifacts RPO ≤ 24 hours and RTO ≤ 8 hours. Validate against business needs before launch. Redis/BullMQ is reconstructible where possible; durable job intent and idempotency live in PostgreSQL.

## Backup

Use encrypted automated snapshots plus point-in-time recovery, isolated credentials, cross-failure-domain copy, retention tiers, deletion protection and integrity monitoring. Export IaC state/config metadata securely. Do not copy provider secrets into ordinary backup archives.

## Restore drill

At least quarterly, restore into an isolated recovery environment; verify schema/migrations, row counts/checksums, ownership boundaries, session revocation policy, audit continuity, object references, application smoke, queue reconciliation, and privacy deletions. Measure actual RPO/RTO and retain evidence.

## Disaster sequence

Declare incident; freeze risky writes/deployments; identify recovery point; obtain approval; provision from reviewed IaC; restore database/objects/config; rotate potentially exposed secrets; reconcile/replay idempotent jobs; deploy pinned artifact; validate security/data/business invariants; reopen progressively; communicate and review.

Never claim recoverability from successful backup jobs alone. A verified restore is the evidence.
