# Backup and disaster recovery

## Tiering

- Tier 1: users, sessions, answers, evaluations, prompts/rubrics, audit.
- Tier 2: Redis queue state, derived learning/report read models.
- Tier 3: rebuildable cache/telemetry aggregates.

## Targets

- Tier 1 RPO ≤ 15 phút, RTO ≤ 60 phút.
- PostgreSQL PITR + daily backup; cross-zone and tested encryption.
- Redis persistence/replication theo managed service; source of truth vẫn ở PostgreSQL.
- IaC và image version đủ để rebuild environment.

## Restore drill

Quarterly: restore isolated environment, verify schema/migrations, reconcile session/answer/evaluation counts, run smoke tests, verify access isolation, record actual RPO/RTO và destroy drill environment an toàn.
