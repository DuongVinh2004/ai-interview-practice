# Production release runbook

- **Primary Owner:** CI/CD & SRE Owner (Duong Vinh)
- **Security Reviewer:** Security Owner (Duong Vinh)
- **Last Reviewed:** 2026-09-01
- **Review Cadence:** Monthly / per release milestone

This runbook is the operational gate for the P1 production-readiness controls. A release is promoted only from a successful `CI Pipeline` run on `main` or `master`; `.github/workflows/deploy.yml` has no manual or SSH deployment path.

## One-time platform prerequisites

- Bootstrap the two immutable ECR repositories first with a reviewed, ECR-only Terraform target plan. Build and push the initial API/web images, resolve their registry digests, then perform the full production Terraform plan/apply with both `api_image` and `web_image` ending in `@sha256:<64 lowercase hex characters>`. Do not start ECS services with placeholder images.
- Point the production DNS name at the Terraform ALB and use the matching ACM certificate ARN.
- Configure GitHub environments `staging` and `production`; require an independent reviewer for production and restrict both to protected release branches.
- Configure GitHub OIDC secret `AWS_DEPLOY_ROLE_ARN`. Do not create long-lived AWS access-key repository secrets.
- Configure `STAGING_BASE_URL` and `PRODUCTION_BASE_URL` as HTTPS origins for post-deploy acceptance checks.
- Grant the deploy role only the ECR push, ECS task registration/run/update/read, `iam:PassRole` for the execution and scoped task roles (`api_task_role`, `worker_task_role`, `web_task_role`), and log-read permissions needed by the workflow.
- Populate the generated Secrets Manager value with at least one real AI provider credential and any enabled billing credentials. Keep the generated database, Redis, JWT, MFA, certificate, and metrics values. Terraform intentionally ignores later `secret_string` changes so a rotation is not overwritten.
- Confirm RDS automated backups/PITR, deletion protection, Multi-AZ, ElastiCache TLS/auth, private task subnets, and ALB access logging are enabled by the reviewed Terraform plan.

## Release gate

Before merging, require the following checks from `.github/workflows/ci.yml`:

1. Frozen-lockfile installation on Node 22.13.0 and pnpm 11.0.9.
2. Formatting, lint, type checks, unit/integration/E2E tests, and production builds.
3. Static expand/contract migration validation followed by `prisma migrate deploy` against the isolated CI database.
4. API, worker, web, and ingress container validation.
5. Dependency inventory/SBOM generation plus blocking Gitleaks, Trivy SCA/IaC, production dependency-audit, and Semgrep gates in the same CI run consumed by CD. The scheduled security workflow remains defense in depth, not the release signal.

The deployment workflow checks out the exact successful CI SHA, builds API and web images once, pushes source-SHA tags to immutable ECR repositories, resolves both registry digests, and writes a checksummed release manifest. Staging consumes those digests first; production reuses the same manifest and never rebuilds.

ECS release task-definition revisions and autoscaled desired counts are owned by CD/ECS, so Terraform intentionally ignores those two service fields. This prevents a later infrastructure apply from reverting a successfully promoted release.

## Deployment sequence

1. Register new staging API, worker, and web task-definition revisions using the resolved digests.
2. Run `prisma migrate deploy` as an isolated Fargate task using the new API task definition. A non-zero exit stops the rollout.
3. Update all three ECS services. Each service retains 100% minimum health and uses the ECS deployment circuit breaker with rollback enabled.
4. Wait for staging services to become stable and pass HTTPS acceptance checks.
5. After production-environment approval, register/update production with the exact same digests. If either rollout fails, restore that environment's exact prior task-definition ARNs.
6. Retain the manifest/SBOM/checksum artifact keyed by source SHA and the old/new task-definition ARNs for both environments.

Database migrations must remain forward-compatible with the previous application revision. Destructive schema cleanup is a later, separately approved contract release after rollback compatibility has expired.

The authoritative-evaluation migration deliberately fails if historical rows lack a supported real provider, non-empty evidence, or a matching authoritative session score. Treat this as a data-triage gate: review the reported records and explicitly classify ambiguous evaluations as `NEEDS_REVIEW`. Do not bypass the migration or synthesize provenance.

## Post-deployment checks

- Confirm the ALB serves the web application at `/` and API readiness at `/api/v1/health/ready` over HTTPS.
- Confirm `/api/v1/metrics` is not publicly reachable.
- Confirm API and worker logs show remote TLS Redis, no mock provider selection, and distributed budget reservations.
- Exercise login, refresh, MFA completion, and logout. The browser must contain no access or refresh token in local/session storage; refresh is an HttpOnly, Secure, SameSite=Lax cookie scoped to `/api/v1/auth`.
- Exercise a mock/fallback evaluation in a non-production test environment and confirm it cannot change the authoritative overall score, XP, certificates, notifications, or learning path.

## Application rollback

Use the prior API, worker, and web task-definition ARNs recorded by the release artifact. Do not rebuild source on a server and do not reverse the database migration. Because migrations use expand/contract compatibility, the prior task definitions remain valid against the expanded schema.

If the prior revision is not compatible, stop the rollout and treat it as an incident. Do not reset, truncate, drop, or restore production data as an application rollback shortcut.

## Backup and restore evidence

- Run `infra/scripts/backup-pitr.sh` from a hardened backup runner with PostgreSQL, OpenSSL, and AWS CLI available. It creates a custom-format dump, encrypts it before disk persistence, verifies SHA-256, uploads with KMS encryption, and verifies the S3 object.
- Provision a separate empty database named `ai_interview_restore_drill_<identifier>`. Never point the drill script at production or an existing database.
- Set `DRILL_ENVIRONMENT=disposable`, the backup/checksum paths, encryption key, recovery-point timestamp, and the isolated `DRILL_DATABASE_URL`; then run `infra/scripts/restore-drill.sh`.
- Archive the generated JSON evidence. A valid drill must pass checksum, critical-table, constraint, RPO, and RTO checks. Missing evidence or any command failure is a failed release gate, never a synthetic PASS.

Production data deletion, database reset, destructive migration, or infrastructure teardown requires a separate exact-target authorization and is outside this runbook.
