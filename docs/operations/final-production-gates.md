# Final Production Release Gates & Operational Verification Runbook

## Overview

This runbook defines the mandatory verification gates and operator execution procedures required before promoting any release candidate to Production traffic.

---

### Gate 1 — Pre-Deployment Configuration & Secrets Validation (EXT-GATE-001)

- **Gate ID**: `EXT-GATE-001`
- **Purpose**: Verify that all required production secrets, encryption keys, and environment variables are provisioned without leaking secrets into logs or shell history.
- **Preconditions**: AWS Secrets Manager / Parameter Store populated for the target production cluster.
- **Safe Command**:
  ```bash
  node infra/scripts/validate-production-config.mjs
  ```
- **Expected Output**:
  ```text
  ✅ Configuration validation PASSED: Pre-deployment environment is sound.
  Exit Code: 0
  ```
- **Fail Conditions**: Any missing secret, JWT secrets collision (`JWT_ACCESS_SECRET === JWT_REFRESH_SECRET`), Redis without TLS, or mock providers enabled in production (`AI_PROVIDER=mock`).
- **Evidence File**: Operational validation log / ECS task boot event log.
- **Rollback**: Abort deployment; review AWS Secrets Manager parameter mapping in ECS task definition.
- **Owner**: SRE / Platform Lead.

---

### Gate 2 — Staging Immutable Digest Promotion & Health Smoke (EXT-GATE-002)

- **Gate ID**: `EXT-GATE-002`
- **Purpose**: Validate that staging was deployed with an exact immutable image digest (`@sha256:...`) and passed deep acceptance health smoke tests before production promotion.
- **Preconditions**: CI workflow `validate-and-test` passed; staging ECS service updated.
- **Safe Command**:
  ```bash
  API_BASE_URL="https://staging.app.example.com" STRICT_SMOKE_TEST=true npx ts-node infra/scripts/smoke-test.ts
  ```
- **Expected Output**:
  ```text
  📊 [Smoke Test Summary]
  Total Checks: 6 | Passed: 6 | Failed: 0
  Overall Health Status: HEALTHY ✅
  ```
- **Fail Conditions**: Any 5xx on health endpoints, public exposure of `/api/v1/metrics` (expected 404), or OpenAPI schema failure.
- **Evidence File**: `artifacts/staging-smoke/staging-smoke-<timestamp>.json`.
- **Rollback**: Automatic ECS Task Definition rollback to prior active revision via `infra/scripts/promote-ecs-release.sh`.
- **Owner**: Release Engineer.

---

### Gate 3 — Live Database Restore Drill & Point-in-Time Recovery (EXT-GATE-003)

- **Gate ID**: `EXT-GATE-003`
- **Purpose**: Objectively verify database backup integrity, schema restoration, and recovery bounds (RPO <= 15m, RTO <= 60m) into an isolated disposable database.
- **Preconditions**:
  - Encrypted backup archive available (`BACKUP_FILE` & `BACKUP_SHA256_FILE`).
  - Disposable database provisioned matching naming pattern `ai_interview_restore_drill_*`.
- **Safe Command**:
  ```bash
  DRILL_ENVIRONMENT=disposable \
  BACKUP_FILE="backup-pitr-2026-09-01.enc" \
  BACKUP_SHA256_FILE="backup-pitr-2026-09-01.enc.sha256" \
  DRILL_DATABASE_URL="postgresql://user:pass@db-restore.internal:5432/ai_interview_restore_drill_20260901" \
  SOURCE_RECOVERY_POINT_UTC="2026-09-01T12:00:00Z" \
  BACKUP_ENCRYPTION_KEY="$BACKUP_PASSPHRASE" \
  ./infra/scripts/restore-drill.sh
  ```
- **Expected Output**:
  ```text
  Restore evidence written to artifacts/restore-drill/restore-drill-<timestamp>.json
  RPO: <seconds>s (PASS); RTO: <seconds>s (PASS)
  Exit Code: 0
  ```
- **Fail Conditions**: SHA-256 checksum mismatch, table count < 10, missing critical tables (`users`, `interview_sessions`, `evaluations`), invalid constraints, or RPO/RTO exceeded.
- **Evidence File**: `artifacts/restore-drill/restore-drill-<timestamp>.json`.
- **Rollback**: Destroy disposable restore database; investigate backup snapshot pipeline.
- **Owner**: Database Administrator / SRE.

---

### Gate 4 — Judge0 Sandbox Live Connectivity (EXT-GATE-004)

- **Gate ID**: `EXT-GATE-004`
- **Purpose**: Verify live remote Judge0 sandbox connectivity and test execution if `FEATURE_LIVE_CODING=true`.
- **Preconditions**: Remote Judge0 API cluster reachable with valid API key.
- **Safe Command**:
  ```bash
  node infra/scripts/verify-judge0.mjs
  ```
- **Expected Output**:
  ```text
  ✅ Judge0 execution successful! (stdout: "judge0-smoke-ok")
  📄 Evidence artifact generated: artifacts/judge0/judge0-smoke-<timestamp>.json
  Exit Code: 0
  ```
- **Fail Conditions**: HTTP 401/403 (invalid key), HTTP 500, execution timeout > 10s, or stdout mismatch.
- **Evidence File**: `artifacts/judge0/judge0-smoke-<timestamp>.json`.
- **Rollback**: Disable live coding flag `FEATURE_LIVE_CODING=false` or restart Judge0 worker nodes.
- **Owner**: Security & Sandbox Lead.

---

### Gate 5 — Alertmanager Downstream Routing & Delivery Channel (EXT-GATE-005)

- **Gate ID**: `EXT-GATE-005`
- **Purpose**: Prove end-to-end delivery of Prometheus alerts to operator communications (Slack / PagerDuty).
- **Preconditions**: Alertmanager service or webhook endpoint configured.
- **Safe Command**:
  ```bash
  ALERTMANAGER_URL="http://alertmanager.internal:9093" node infra/scripts/verify-alert-delivery.mjs
  ```
- **Expected Output**:
  ```text
  ✅ Synthetic alert delivered successfully (<ms>ms)
  📄 Evidence artifact generated: artifacts/alerts/alert-delivery-<timestamp>.json
  Exit Code: 0
  ```
- **Fail Conditions**: HTTP 5xx from Alertmanager, routing key rejection, or unreachable webhook.
- **Evidence File**: `artifacts/alerts/alert-delivery-<timestamp>.json`.
- **Rollback**: Check Alertmanager config map and secret credentials.
- **Owner**: SRE / Observability Lead.
