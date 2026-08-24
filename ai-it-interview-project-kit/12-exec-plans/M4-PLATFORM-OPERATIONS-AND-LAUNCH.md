# [AIP-050..AIP-064] Milestones M4 & M5: Platform Operations, IaC, Observability, Disaster Recovery & Release Readiness

## Purpose and observable outcome

Establish the complete platform engineering foundation, automated security scanning, production Infrastructure as Code (IaC), distributed tracing, Prometheus metrics exporter, Grafana dashboards, Alertmanager SLO alert rules, Point-in-Time Recovery (PITR) backup & restore drills, Game Day chaos testing, and production release dossier with smoke test automation.

Reviewers and platform operators can prove this outcome by:
1. Validating automated CI security scanning (SAST, Gitleaks, Trivy SCA/IaC) and reviewing `SECURITY.md`.
2. Inspecting and validating modular Terraform infrastructure in `infra/terraform/` covering VPC, Multi-AZ RDS PostgreSQL, ElastiCache Redis, encrypted S3 buckets, ECS Fargate compute, and Secrets Manager.
3. Accessing the `/metrics` endpoint in the API to scrape Prometheus metrics (RED metrics, BullMQ queues, AI token spend & cost, Circuit Breaker status) and inspecting distributed trace propagation via W3C TraceContext.
4. Executing automated PITR backup scripts (`backup-pitr.sh`, `backup-redis.sh`) and running the automated restore drill (`restore-drill.sh`) measuring RPO and RTO.
5. Running the Chaos Game Day simulator test proving automatic fallback, zero data loss, and worker resilience during provider and network outages.
6. Reviewing the Release Dossier v1.0 and executing the production smoke test suite (`smoke-test.ts`).

## Baseline

- Official repository: `https://github.com/DuongVinh2004/ai-interview-practice.git`
- Milestones M0, M1, M2, M3: Fully implemented and verified (108 backend tests, 34 frontend tests, 8 contract tests, 0 lint/typecheck errors).
- Related Project Kit docs: `05-architecture/IAC-AND-PLATFORM.md`, `05-architecture/DEPLOYMENT-TOPOLOGY.md`, `06-data/BACKUP-AND-DR.md`, `09-security-privacy/SECURITY-BASELINE.md`, `13-operations/OBSERVABILITY.md`, `13-operations/SLO-ALERTING.md`, `13-operations/BACKUP-DR-RUNBOOK.md`, `15-quality-evidence/RELEASE-EVIDENCE-TEMPLATE.md`.

## Scope and non-goals

### Inclusions
- Security: CI scanning workflows (Semgrep, Gitleaks, Trivy), `SECURITY.md` (VDP, SLAs, contact), pre-launch penetration test report.
- Infrastructure: Modular Terraform/OpenTofu files in `infra/terraform/` for VPC, RDS Multi-AZ, ElastiCache, S3, ECS Fargate, and Secrets Manager; hardened Dockerfiles; Nginx reverse proxy with SSE tuning.
- Observability: Prometheus metrics registry & `/metrics` endpoint (`prom-client`), OpenTelemetry distributed trace propagation across API, queues, and AI providers; declarative Grafana dashboards & Alertmanager alert rules.
- Disaster Recovery: PITR backup scripts for PostgreSQL and Redis, automated restore drill with row-count reconciliation and RPO/RTO calculation; Chaos Game Day test simulator.
- Release: Production release dossier v1.0, sign-off checklist, canary rollout strategy, and end-to-end smoke test script.

### Exclusions (Non-goals)
- Mutating live paid cloud resources during local verification.
- Replacing the core NestJS modular architecture.
- Removing or weakening any existing functional or AI evaluation tests.

## Acceptance criteria

- [x] Given the CI pipeline, when changes or PRs are submitted, then SAST, secret detection, and vulnerability scanning run automatically.
- [x] Given `SECURITY.md`, it clearly specifies vulnerability disclosure procedures, triage SLAs (24h ack, 72h triage, 14d fix), and contact details.
- [x] Given `infra/terraform/`, the Terraform modules configure a production-grade AWS architecture (VPC, RDS Multi-AZ, ElastiCache, S3, ECS Fargate, Secrets Manager) with security best practices and drift check capabilities.
- [x] Given `apps/api`, `GET /metrics` exports standard Prometheus metrics for HTTP traffic, BullMQ queues, AI token usage & estimated cost, and Circuit Breaker states.
- [x] Given incoming requests, W3C TraceContext (`traceparent`, `X-Trace-Id`) is propagated across API, worker jobs, and SSE streams.
- [x] Given `infra/grafana/dashboards/` and `infra/prometheus/`, declarative JSON dashboards and Alertmanager alert rules monitor SLOs and trigger alerts on high error rates, queue lag, and AI provider downtime.
- [x] Given `infra/scripts/`, `backup-pitr.sh` and `backup-redis.sh` automate encrypted backups, while `restore-drill.sh` verifies data integrity, schema consistency, and measures RTO and RPO against targets (RPO ≤ 15m, RTO ≤ 60m).
- [x] Given `apps/api/test/chaos/chaos-gameday.spec.ts`, simulated AI provider and Redis outages confirm circuit breaker tripping, graceful fallback with zero data loss, and worker resilience.
- [x] Given `ai-it-interview-project-kit/15-quality-evidence/RELEASE-DOSSIER-v1.0.md` and `infra/scripts/smoke-test.ts`, launch criteria, canary rollout plan, and automated smoke testing are fully documented and executable.

## Milestones

- [x] **M4.1 — Security Hardening & Automated Scanning CI Pipeline (Epic E12)**
  - `.github/workflows/security.yml`
  - `SECURITY.md`
  - `ai-it-interview-project-kit/09-security-privacy/PEN-TEST-REPORT-PRELAUNCH.md`
- [x] **M4.2 — Infrastructure as Code & Production Containerization (Epic E13)**
  - `infra/terraform/` (Network, Database, Redis, Storage, Compute, Secrets)
  - `infra/scripts/terraform-drift-check.sh`
  - Hardened `apps/api/Dockerfile`, `apps/web/Dockerfile`, and `infra/nginx/` configs.
- [x] **M4.3 — Full-Stack Observability, Tracing & SLO Alerting (Epic E14)**
  - `apps/api/src/modules/platform/metrics/` (`metrics.service.ts`, `metrics.controller.ts`, `metrics.module.ts`)
  - `apps/api/src/modules/platform/telemetry/` (`telemetry.service.ts`, `telemetry.module.ts`)
  - `infra/grafana/dashboards/` & `infra/prometheus/alert_rules.yml`
- [x] **M4.4 — Backup, PITR & Disaster Recovery (DR) Drills (Epic E15)**
  - `infra/scripts/backup-pitr.sh` & `infra/scripts/backup-redis.sh`
  - `infra/scripts/restore-drill.sh`
  - `apps/api/test/chaos/chaos-gameday.spec.ts` & `ai-it-interview-project-kit/15-quality-evidence/GAMEDAY-SIMULATION-REPORT.md`
- [x] **M5.1 — Controlled Launch & Release Dossier (Epic E16)**
  - `ai-it-interview-project-kit/15-quality-evidence/RELEASE-DOSSIER-v1.0.md`
  - `infra/scripts/smoke-test.ts` & `infra/scripts/smoke-test.sh`

## Verification

1. `pnpm lint` and `pnpm type-check` pass with 0 errors.
2. `pnpm test` passes 100% across contracts, backend, frontend, and new chaos/metrics suites.
3. Verification of Terraform syntax and structure.
4. Execution of smoke tests and chaos test scenarios.
