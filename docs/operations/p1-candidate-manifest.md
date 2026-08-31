# P1 release candidate manifest

**Status:** Final local scope awaiting user review  
**Captured:** 2026-09-01 (Asia/Bangkok)  
**Repository:** https://github.com/DuongVinh2004/ai-interview-practice.git  
**Baseline branch:** main  
**Baseline HEAD:** d0c09cef4f80cf7d4bcbb6c42328a65e55a5d895  
**Candidate commit:** Not created  
**Release verdict:** NO_GO

## Purpose

This manifest defines the exact provisional file scope for the P1 production-readiness candidate. It does not stage, commit, move, remove, or overwrite any existing work. The candidate remains provisional until the user approves this scope and authorizes the Git operation separately.

## Snapshot summary

| Category                                               |         Count | Treatment                                              |
| ------------------------------------------------------ | ------------: | ------------------------------------------------------ |
| Tracked files with a real content diff                 |           103 | Include in final local P1 candidate                    |
| New P1/code/test/operations files before this manifest |            43 | Include                                                |
| This manifest                                          |             1 | Include, but exclude from its own snapshot fingerprint |
| Total candidate paths                                  |           147 | Review required                                        |
| Untracked root utilities                               |            25 | Exclude and preserve unchanged                         |
| Ignored sensitive/build/tool state explicitly checked  | 5 path groups | Exclude and preserve unchanged                         |
| Staged paths                                           |             0 | None                                                   |

Git reports core.autocrlf=true. Candidate construction must use the exact paths below and a content diff check, never a broad git add -A or wildcard.

## Snapshot fingerprint

The following digest was computed from sorted records in the form:

`	ext
<tracked-modified|untracked-new>\t<repository-relative-path>\t<file-sha256>\n
`

It covers the 146 pre-manifest candidate files (103 tracked content diffs and 43 new files). This manifest is intentionally excluded from its own fingerprint.

`	ext
sha256:cdd985fcb084940426a3f154e5d558031a51e5035cccc5f98b1c49e58c3ce93f
`

The fingerprint becomes stale as soon as any included file changes. It must be regenerated immediately before staging and again before commit.

## Inclusion rationale

The provisional scope is a single cohesive production-readiness change set:

- deterministic toolchain, CI security gates and release workflow invariants;
- refresh-cookie/MFA/browser-token hardening;
- fail-closed production environment validation;
- global distributed AI cost reservations;
- authoritative evaluation provenance and downstream side-effect suppression;
- historical-data migration enforcement;
- immutable ECS/ECR deployment, private metrics and rollback behavior;
- ECS task-role/default-chain S3 authentication and least-privilege object/KMS access;
- backup/restore safety and production operations evidence.

## Exact included paths

### Repository / Toolchain and Workflows

- .env.example
- .github/workflows/ci.yml
- .github/workflows/deploy.yml
- .github/workflows/security.yml
- .gitignore
- .node-version
- docker-compose.yml
- package.json
- pnpm-lock.yaml

### API, Database, Platform and Worker

- apps/api/.env.example
- apps/api/Dockerfile
- apps/api/prisma/migrations/20260826160000_complete_schema_coverage/migration.sql
- apps/api/prisma/migrations/20260827010000_expand_question_bank_access_period_key/migration.sql
- apps/api/prisma/migrations/20260829190000_enforce_authoritative_evaluation_invariants/migration.sql
- apps/api/src/app.module.ts
- apps/api/src/main.ts
- apps/api/src/modules/admin/admin.service.ts
- apps/api/src/modules/ai-orchestrator/ai-orchestrator.service.ts
- apps/api/src/modules/ai-orchestrator/router/provider-router.service.spec.ts
- apps/api/src/modules/ai-orchestrator/router/provider-router.service.ts
- apps/api/src/modules/ai-orchestrator/security/ai-security-filter.service.ts
- apps/api/src/modules/analytics/analytics.service.spec.ts
- apps/api/src/modules/analytics/analytics.service.ts
- apps/api/src/modules/audio-orchestrator/audio-orchestrator.service.spec.ts
- apps/api/src/modules/audio-orchestrator/audio-orchestrator.service.ts
- apps/api/src/modules/auth/auth.controller.spec.ts
- apps/api/src/modules/auth/auth.controller.ts
- apps/api/src/modules/auth/auth.service.ts
- apps/api/src/modules/auth/dto/auth.dto.ts
- apps/api/src/modules/auth/guards/roles.guard.ts
- apps/api/src/modules/billing/entitlement-reservation.service.spec.ts
- apps/api/src/modules/billing/entitlement-reservation.service.ts
- apps/api/src/modules/email/email.module.ts
- apps/api/src/modules/evaluation/evaluation-authority.ts
- apps/api/src/modules/evaluation/evaluation.authority.spec.ts
- apps/api/src/modules/evaluation/evaluation.module.ts
- apps/api/src/modules/evaluation/evaluation.processor.spec.ts
- apps/api/src/modules/evaluation/evaluation.processor.ts
- apps/api/src/modules/gamification/xp.service.ts
- apps/api/src/modules/history-report/history-report.service.spec.ts
- apps/api/src/modules/history-report/history-report.service.ts
- apps/api/src/modules/interview/interview.controller.spec.ts
- apps/api/src/modules/interview/interview.controller.ts
- apps/api/src/modules/interview/interview.module.ts
- apps/api/src/modules/interview/interview.service.spec.ts
- apps/api/src/modules/interview/interview.service.ts
- apps/api/src/modules/learning-path/learning-path.module.ts
- apps/api/src/modules/learning-path/learning-path.processor.spec.ts
- apps/api/src/modules/learning-path/learning-path.processor.ts
- apps/api/src/modules/mentor/services/live-session.service.ts
- apps/api/src/modules/notifications/push-notification.service.spec.ts
- apps/api/src/modules/platform/budget/distributed-budget.service.spec.ts
- apps/api/src/modules/platform/budget/distributed-budget.service.ts
- apps/api/src/modules/platform/config/configuration.ts
- apps/api/src/modules/platform/config/env.validation.spec.ts
- apps/api/src/modules/platform/config/env.validation.ts
- apps/api/src/modules/platform/interceptors/logging.interceptor.ts
- apps/api/src/modules/platform/metrics/metrics.service.spec.ts
- apps/api/src/modules/platform/metrics/metrics.service.ts
- apps/api/src/modules/platform/platform.module.ts
- apps/api/src/modules/platform/process-role.ts
- apps/api/src/modules/portfolio/portfolio.service.spec.ts
- apps/api/src/modules/portfolio/services/badge.service.ts
- apps/api/src/modules/portfolio/services/certificate.service.ts
- apps/api/src/modules/profile/profile.service.ts
- apps/api/src/modules/question-bank/**tests**/period-key.spec.ts
- apps/api/src/modules/question-bank/**tests**/response-mapper.spec.ts
- apps/api/src/modules/question-bank/services/question-bank-entitlement.service.ts
- apps/api/src/modules/readiness/services/readiness.service.ts
- apps/api/src/modules/share/share.service.spec.ts
- apps/api/src/modules/share/share.service.ts
- apps/api/src/modules/skill-graph/services/skill-aggregation.service.ts
- apps/api/src/modules/skill-graph/skill-graph.module.ts
- apps/api/src/modules/storage/providers/s3-storage.provider.spec.ts
- apps/api/src/modules/storage/providers/s3-storage.provider.ts
- apps/api/src/modules/storage/storage.service.spec.ts
- apps/api/src/modules/storage/storage.service.ts
- apps/api/src/modules/voice-gateway/voice-streaming.gateway.spec.ts
- apps/api/src/worker.ts
- apps/api/test/eval/epic3-forensic-audit.spec.ts

### Web Application

- apps/web/e2e/all-features.spec.ts
- apps/web/package.json
- apps/web/playwright.config.ts
- apps/web/src/App.tsx
- apps/web/src/**tests**/CacheIsolation.test.tsx
- apps/web/src/**tests**/Epic8MfaAuthentication.test.tsx
- apps/web/src/components/layout/ProtectedRoute.tsx
- apps/web/src/features/auth/LoginPage.tsx
- apps/web/src/features/auth/RegisterPage.tsx
- apps/web/src/features/profile/ProfilePage.tsx
- apps/web/src/features/setup/SetupInterviewPage.tsx
- apps/web/src/hooks/use-interview-sse.test.ts
- apps/web/src/hooks/use-interview-sse.ts
- apps/web/src/hooks/useTutor.ts
- apps/web/src/lib/api-client.ts
- apps/web/src/stores/**tests**/auth.store.test.ts
- apps/web/src/stores/auth.store.ts
- apps/web/vite.config.ts

### Infrastructure and Operations Automation

- infra/scripts/backup-pitr.sh
- infra/scripts/check-migration-safety.mjs
- infra/scripts/check-release-workflows.mjs
- infra/scripts/promote-ecs-release.sh
- infra/scripts/restore-drill.sh
- infra/scripts/smoke-test.sh
- infra/terraform/bootstrap/.terraform.lock.hcl
- infra/terraform/bootstrap/backend.hcl.example
- infra/terraform/bootstrap/main.tf
- infra/terraform/bootstrap/outputs.tf
- infra/terraform/bootstrap/terraform.tfvars.example
- infra/terraform/bootstrap/variables.tf
- infra/terraform/bootstrap/versions.tf
- infra/terraform/environments/production/backend.hcl.example
- infra/terraform/environments/production/main.tf
- infra/terraform/environments/staging/backend.hcl.example
- infra/terraform/environments/staging/main.tf
- infra/terraform/main.tf
- infra/terraform/modules/compute/main.tf
- infra/terraform/modules/compute/outputs.tf
- infra/terraform/modules/compute/variables.tf
- infra/terraform/modules/network/main.tf
- infra/terraform/modules/secrets/main.tf
- infra/terraform/modules/secrets/outputs.tf
- infra/terraform/outputs.tf
- infra/terraform/terraform.tfvars.example
- infra/terraform/variables.tf
- infra/terraform/versions.tf
- infra/testing/Dockerfile.playwright
- infra/testing/run-playwright-e2e.sh

### Contracts

- packages/contracts/src/**tests**/schemas.test.ts
- packages/contracts/src/schemas/auth.ts
- packages/contracts/src/schemas/storage.ts

### Production-Readiness Documentation

- docs/operations/p1-candidate-manifest.md
- docs/operations/p1-production-readiness-evidence.md
- docs/operations/production-readiness-candidate-policy.md
- docs/operations/production-readiness-closure-records.md
- docs/operations/production-readiness-decision-register.md
- docs/operations/production-readiness-execution-model-amendment-002.md
- docs/operations/production-readiness-execution-plan.md
- docs/operations/production-readiness-finding-register.md
- docs/operations/production-readiness-master-plan.md
- docs/operations/production-readiness-owner-matrix.md
- docs/operations/production-readiness-task-ledger.yaml
- docs/operations/production-release-runbook.md
- docs/operations/production-slo-alert-policy.md
- docs/operations/provider-secrets-runbook.md
- docs/operations/terraform-bootstrap-runbook.md
- docs/security/entitlement-reconciliation-runbook.md

## Exact excluded untracked paths

The following 25 files are pre-existing local investigation/simulation utilities. They are not referenced by the application, package scripts, CI/CD workflows or Terraform entrypoints. They must remain untracked and unchanged unless the user starts a separate task for them.

- pply_round_robin.py
- check_locks.py
- check_locks_exact.py
- compare_accounts.py
- inspect_403_details.py
- inspect_4884.py
- inspect_5781.py
- inspect_chunk_9248.py
- inspect_db.py
- inspect_db_methods.py
- inspect_filter.py
- inspect_logfile.py
- inspect_mitm.py
- inspect_new_accounts.py
- inspect_onboarding.py
- inspect_request_details.py
- inspect_routing_full.py
- inspect_snippets.py
- inspect_update_fn.py
- inspect_update_fn2.py
- inspect_upstream.py
- est_account_tokens.py
- est_node.js
- erify_round_robin.py
- erify_simulation_exact.py

## Explicitly excluded ignored state

- .env
- pps/api/.env
- pps/api/dist/
- infra/terraform/environments/staging/.terraform/
- infra/terraform/environments/production/.terraform/

## Candidate construction rules

1. Never use git add -A, git add ., a wildcard or a generated broad path list.
2. Recompute the exact included path set and hashes immediately before staging.
3. Stop if any included path is missing, any unexpected staged path exists or the excluded set changes.
4. Stage only explicit reviewed paths after direct user authorization to create the candidate commit.
5. Compare git diff --cached --name-status against this manifest before commit.
6. Run candidate-only Gitleaks/Semgrep/Trivy/audit and all release gates against staged content or the resulting commit.
7. The resulting commit SHA replaces the baseline reference in all evidence.
8. Do not push until the user separately authorizes the remote mutation.

## Approval record

| Decision             | Status              | Approver/evidence                              |
| -------------------- | ------------------- | ---------------------------------------------- |
| Candidate path scope | Pending             | User review required                           |
| Local release gates  | Pass (working tree) | Full local verification passed 2026-09-01      |
| Commit creation      | Not authorized      | Separate direct user instruction required (L2) |
| Push/PR creation     | Not authorized      | Separate direct user instruction required (L3) |
| Production promotion | NO_GO               | External gates not complete                    |
