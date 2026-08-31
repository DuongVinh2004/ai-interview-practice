# P1 production-readiness implementation evidence

Date: 2026-08-30 (Asia/Bangkok)  
Repository: `https://github.com/DuongVinh2004/ai-interview-practice.git`  
Branch: `main`  
Baseline HEAD: `d0c09cef4f80cf7d4bcbb6c42328a65e55a5d895`  
Working tree: dirty before remediation; all pre-existing staged, unstaged, untracked, and ignored work was preserved.

## Outcome

The repository-side P1 remediation is implemented. Immediate production promotion remains `NO_GO` until the external gates in this document have produced evidence for the exact release SHA. This is intentional: a missing Terraform plan, immutable-image build, or real restore drill is `UNKNOWN`, not `PASS`.

## Control evidence

| P1 control                               | Implementation                                                                                                                                                                                                                                                                                                                  | Regression evidence                                                                                                                                                                                             | Status                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Deterministic toolchain and release gate | Exact Node/pnpm contracts, pinned actions/scanners, frozen install, migration gate, security gates in the same CI consumed by CD                                                                                                                                                                                                | Contracts/API/web build and tests pass locally; CI syntax parses through Prettier                                                                                                                               | Implemented; exact CI run required          |
| Immutable deployment and rollback        | Source-SHA image tags resolved to ECR digests; API/worker share one API digest; web uses its digest; exact prior task-definition ARNs are restored on failure                                                                                                                                                                   | Digest validation in Terraform; no SSH/manual CD path; manual CI runs cannot trigger CD                                                                                                                         | Implemented; staging rollout required       |
| Production configuration and secrets     | Fail-fast HTTPS CORS, distinct strong JWT secrets, remote TLS Redis, non-local DB, real AI/storage providers, metrics token, global budget variables; Secrets Manager rotations are not overwritten                                                                                                                             | `env.validation.spec.ts` covers mock-provider, CORS, Redis, metrics, budget, and storage rejection paths                                                                                                        | PASS locally                                |
| Browser authentication                   | Refresh token is only an HttpOnly/Secure/SameSite cookie; public contracts omit it; access token remains memory-only; refresh/logout require cookie plus trusted-origin/custom-header checks                                                                                                                                    | Controller and store tests prove no raw refresh-token response and no token persistence                                                                                                                         | PASS locally                                |
| Authorization/BOLA                       | Owned-resource and tenant guards remain fail-closed across interview, audio, documents, code execution, system design, question bank, mentor, and B2B paths                                                                                                                                                                     | Full API suite includes ownership, tenant, role, and negative authorization suites                                                                                                                              | PASS locally                                |
| Global AI cost cap                       | Redis Lua atomically reserves maximum paid-call cost in a shared namespace; API and audio paid paths use it; production fails closed if enforcement is unavailable; ambiguous provider failures retain reservations                                                                                                             | Distributed budget and provider/audio fallback tests pass                                                                                                                                                       | PASS locally                                |
| Authoritative AI boundary                | A shared provenance policy requires an explicit supported provider, non-empty evidence, `AUTHORITATIVE`, and `needsReview=false`; mock/missing-evidence output cannot change overall score, analytics, history/public-share summaries, XP, badges, certificates, readiness, skill aggregation, notifications, or learning paths | Authority regressions prove mock `9.9`/`10` results remain review-only; analytics/report/share scores are suppressed; the learning-path worker blocks review-only jobs and ignores mock turns in mixed sessions | PASS locally                                |
| Historical data integrity                | Migration audits ambiguous historical provenance and session-score mismatches before installing database CHECK constraints                                                                                                                                                                                                      | Static migration safety gate passes; full migration must run on an isolated copy                                                                                                                                | Implemented; staging migration required     |
| Backup/restore                           | Encrypted custom-format backup, SHA-256 and S3/KMS verification; restore only into an explicitly disposable, empty, named drill DB; table/constraint/RPO/RTO JSON evidence                                                                                                                                                      | Both scripts pass Bash syntax validation                                                                                                                                                                        | Implemented; live restore evidence required |

## Commands executed

| Command/gate                                                             | Result                                                                                                                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| API Jest (`--runInBand`)                                                 | PASS — 134/134 suites, 731/731 tests                                                                                                    |
| Web Vitest                                                               | PASS — 51/51 files, 183/183 tests                                                                                                       |
| Contracts Vitest                                                         | PASS — 2/2 files, 17/17 tests                                                                                                           |
| API/web/contracts TypeScript checks                                      | PASS                                                                                                                                    |
| Contracts/API/web production builds                                      | PASS; route splitting keeps every emitted JavaScript chunk below 500 kB                                                                 |
| ESLint over changed TypeScript                                           | PASS — 0 errors; 235 non-blocking warnings remain as warning debt                                                                       |
| Migration safety checker                                                 | PASS                                                                                                                                    |
| Backup and restore script `bash -n`                                      | PASS                                                                                                                                    |
| `docker compose config --quiet` with required digest/config placeholders | PASS using the three actual local image digests and process-only placeholder configuration                                              |
| Workflow Prettier parse/check                                            | PASS                                                                                                                                    |
| Exact-toolchain `pnpm audit --prod --audit-level high`                   | PASS in pinned Node 22.13.0/pnpm 11.0.9 container — 3 moderate, 0 high, 0 critical                                                      |
| Local image build/runtime smoke                                          | PASS for API/web/nginx build, API/worker syntax, migrated disposable-DB readiness, worker graceful shutdown, and both `nginx -t` checks |
| Terraform fmt/init/validate                                              | PASS with Terraform 1.16.0 on a disposable Linux-normalized copy; `init -backend=false`; no workspace artifacts emitted                 |
| Terraform plan                                                           | NOT RUN — no authorized AWS account, region, backend/workspace, or reviewed staging/production target                                   |
| Live restore drill                                                       | NOT RUN — no operator-provisioned disposable DB, encrypted backup, KMS context, or approved staging credentials                         |

## Continuation review on 2026-08-30

The final P1 diff review found and remediated four additional authority-consumer bypasses:

- competency analytics accepted evaluation rows with a missing `authorityState`;
- history reports and public share reports fell back to `NEEDS_REVIEW` scores when no authoritative evaluation existed;
- the learning-path worker trusted the enqueueing producer and consumed every turn, so a stale, retried, or injected queue job could use mock evidence;
- authority checks were duplicated instead of enforcing the same provider/evidence/review-state invariant at each consumer.

`apps/api/src/modules/evaluation/evaluation-authority.ts` is now the shared fail-closed policy. The learning-path worker recomputes its score from authoritative turns only. A mixed session still generates a legitimate learning path, but its mock turn and mock score do not reach the provider input. A review-only session invokes neither the paid provider nor persistence/SSE side effects.

Continuation verification actually executed:

- focused authority/analytics/history/share/learning-path Jest: PASS — 5 suites, 23 tests;
- full API Jest: PASS — 133 suites, 718 tests;
- API TypeScript check plus `tsconfig.build.json` compile with `--noEmit`: PASS;
- workflow and changed-file Prettier parse/check: PASS;
- migration safety checker: PASS;
- backup/restore Git Bash syntax checks: PASS;
- Docker Compose config with required placeholder values: PASS (Docker config remained unreadable in the sandbox, but Compose returned exit code 0).

The existing ignored `apps/api/dist/` directory was not overwritten, preserving pre-existing ignored state. An emitted host build was therefore not repeated after this continuation; the build-config compilation passed without emitting files.

## Container, infrastructure, and external continuation on 2026-08-30

After Docker Desktop became available, the remaining locally executable gates were run without overwriting host build artifacts:

- API, web, and ingress images built successfully using the pinned Node 22.13.0/pnpm 11.0.9 Docker toolchain. Local image IDs were `sha256:d36a983f4907cba13ebf21d92d07050a407b3b74e0910816b54bfaeec645bfa8`, `sha256:c51b3d1300fc21bace5bb6aabdc8264baf270b377a373fa2cccf9f2d57a944a0`, and `sha256:37e77ea5cecd482903ee29a5b310637df028b74cded9c4c472647e870094fbd0` respectively;
- `main.js` and `worker.js` passed Node syntax checks; web and ingress passed `nginx -t`;
- all 13 Prisma migrations deployed successfully into a task-created PostgreSQL container with no volume; API readiness returned 200 and worker readiness plus graceful shutdown passed against the disposable PostgreSQL/Redis pair;
- the prior worker smoke accepted ambiguous timeout exits, including an immediate clean exit. It now polls `/health/ready`, fails if the process exits before readiness, and verifies graceful shutdown. `infra/scripts/check-release-workflows.mjs` statically protects this and the CI/CD provenance, immutable-image, shared API/worker digest, manual-trigger exclusion, and exact-rollback invariants;
- actionlint 1.7.12 passed both release workflows after quoting `GITHUB_ENV`, grouping output writes, preserving intentional literal jq/JMESPath expressions, and making rollback exit handling explicit;
- Terraform 1.16.0 `fmt -check -recursive`, `init -backend=false`, and `validate` passed on a disposable copy normalized to LF like an Ubuntu Git checkout. No `plan`, `apply`, or `destroy` was run;
- Trivy 0.70.0 config scanning passed with zero high/critical Terraform misconfigurations, and a vulnerability-only scan of `pnpm-lock.yaml` reported zero critical production dependency findings. Scanner results that did not complete or could not isolate ignored local secrets are recorded as such rather than promoted to PASS;
- the initial broad Trivy filesystem command exited 1 after timing out on `.codex-quarantine`, not after a vulnerability finding. The CI SCA step is now deterministic and explicitly scans the workspace's single `pnpm-lock.yaml` in vulnerability-only mode; Terraform still has its separate config scan, while source secrets and SAST remain Gitleaks/Semgrep responsibilities;
- the pinned Semgrep command completed with exit 1: five blocking findings came from the pre-existing untracked root utilities `inspect_db.py` and `test_account_tokens.py`. They are not referenced by application, package, workflow, or infrastructure entrypoints; they also access a user-profile database outside this workspace. They were preserved unchanged and are not treated as release-source PASS evidence;
- Gitleaks scanned 31 Git commits with no leaks. A raw local filesystem scan failed only on `.env` and `apps/api/.env`, both verified ignored and untracked. A policy-safe exact non-ignored working-tree snapshot scan was not permitted, so candidate-source Gitleaks remains not fully verified locally;
- GitHub run `33193034284` is a successful push CI run for baseline SHA `d0c09cef4f80cf7d4bcbb6c42328a65e55a5d895`, but it predates the dirty P1 candidate and lacks the new same-run security gates. It is baseline evidence only, not release evidence for the current working tree;
- GitHub `main` branch protection is strict, requires `Lint, Typecheck, Test & Build` and one approving review, and disallows force-push and deletion. The `production` environment is absent (`404`), and no repository-level `AWS_DEPLOY_ROLE_ARN` secret is listed. Production approval and OIDC deployment prerequisites are therefore not configured.

The working tree still has no immutable candidate SHA containing the P1 remediation. None of the local image IDs, baseline GitHub runs, or static workflow results is represented as evidence for a releasable commit.

## Required external evidence before production

All items apply to the same candidate source SHA and are mandatory:

1. A successful `CI Pipeline` push run on protected `main`/`master`, including frozen install, Gitleaks, Trivy SCA/IaC, `pnpm audit`, Semgrep, migration deploy on isolated PostgreSQL, all tests, E2E, builds, and container smoke tests.
2. A reviewed `terraform fmt -check`, `terraform validate`, and production `terraform plan` proving private ECS networking, HTTPS ALB routing, protected metrics, TLS/auth Redis, protected/Multi-AZ RDS, immutable ECR, KMS, and no destructive replacement of persistent resources.
3. A staging rollout using the exact CI SHA and recorded API/web digests, followed by API/worker/web stability and rollback rehearsal to the recorded prior task-definition ARNs.
4. A restore drill into an empty `ai_interview_restore_drill_<identifier>` database with archived PASS JSON showing checksum, critical tables, constraints, RPO, and RTO.
5. Browser smoke evidence for login, MFA, refresh rotation, logout/revocation, absence of browser-stored tokens, negative cross-origin refresh/logout, BOLA attempts, mock-evaluation side-effect suppression, and distributed budget exhaustion.

Until all five exist, the strict release verdict remains `NO_GO` for production and `STAGING_ONLY` for the next execution phase.

## Operational handoff

Follow `docs/operations/production-release-runbook.md`. Do not bypass the historical-authority migration, synthesize provenance, reverse a database migration during application rollback, or run a restore drill against production or any non-empty database.

## Final local candidate verification on 2026-08-30

The remaining locally automatable work was completed after Docker became available:

- API processes no longer register BullMQ processors; only `PROCESS_ROLE=worker` consumes jobs;
- browser restore is single-flight, stale restore responses cannot erase a newer login, and MFA enrollment has an explicit restricted session state;
- the refresh endpoint allowance is 60/minute/IP to avoid legitimate corporate/school NAT lockouts. Login remains 10/minute; refresh still requires the high-entropy HttpOnly cookie, one-time rotation, and replay-family protection;
- admin E2E performs real RFC 6238 enrollment, then verifies MFA-bound refresh-cookie hard reloads and exact admin routes;
- routes and React/Query/Motion vendors are split. The final entry is 280.87 kB (77.40 kB gzip); the largest route is 157.85 kB (43.18 kB gzip), with no 500 kB warning;
- a Playwright runner pins Node 22.13.1, pnpm 11.0.9, Chromium, PostgreSQL, and Redis;
- the production smoke wrapper is LF-only, treats failed liveness as blocking, and passes ShellCheck.

| Final gate                                 | Result                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Contracts Vitest                           | PASS — 2 files, 17 tests                                                                                                  |
| API Jest `--runInBand`                     | PASS — 134 suites, 732 tests                                                                                              |
| Web Vitest                                 | PASS — 51 files, 183 tests                                                                                                |
| Web TypeScript                             | PASS — `tsc --noEmit`                                                                                                     |
| Docker E2E                                 | PASS — 5/5, including 13 migrations, API/worker separation, candidate flows, real admin MFA, and interview vertical slice |
| Production API image                       | PASS — `sha256:8e3ebfa2ee87ca375de1b41acb374b8c68772f88948cb8da4c5a84a044456dd8`, user `nestjs`                           |
| Production web image                       | PASS — `sha256:3871094bf7265fad650af8e797a89006f6f8c9390ce6482edfea66ae44231fac`, user `nginx`                            |
| Workflow/migration checkers and Actionlint | PASS                                                                                                                      |
| Bash syntax and ShellCheck 0.10.0          | PASS                                                                                                                      |
| Terraform 1.16.0                           | PASS — fmt and backend-disabled init/validate for root, bootstrap, staging, and production                                |
| Trivy 0.70.0                               | PASS — 0 High/Critical IaC and lockfile findings                                                                          |
| `pnpm audit --prod --audit-level moderate` | PASS — no known vulnerabilities                                                                                           |

These are local working-tree results, not immutable release evidence. The strict verdict remains `NO_GO` until the candidate is reviewed and committed, CI passes for that SHA, cloud plans are approved, and staging/rollback/restore evidence exists.

## S3 credential-chain remediation on 2026-08-31

The final audit found one release-blocking defect in the production S3 path: the provider supplied placeholder static credentials whenever `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` were absent. That bypassed the AWS SDK default credential provider chain, so the ECS task role provisioned by Terraform could never authenticate the API or worker in staging/production.

The provider now omits `credentials` when no static key pair is configured, allowing the SDK to resolve the ECS task role. A complete explicit key pair remains supported for local development; temporary credentials preserve `AWS_SESSION_TOKEN`. Half-configured pairs, token-only configuration, and leading/trailing whitespace fail closed without logging credential values. Production S3 configuration therefore no longer requires static keys.

Terraform task-role permissions were narrowed to the operations used by the runtime path: `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` on the configured object prefix, plus `kms:Decrypt` and `kms:GenerateDataKey` for the configured key. Unused `s3:ListBucket` and `kms:Encrypt` permissions were removed.

Verification executed against the remediated working tree:

- focused S3/config Jest: PASS — 3 suites, 39 tests;
- full API Jest: PASS — 134 suites, 731 tests;
- API TypeScript `tsc --noEmit`: PASS;
- production API image: PASS — `sha256:8e3ebfa2ee87ca375de1b41acb374b8c68772f88948cb8da4c5a84a044456dd8`, runtime user `nestjs`/UID 1001, API and worker entrypoint syntax valid;
- Docker Playwright E2E on task-created disposable PostgreSQL/Redis: successful — all five tests completed, reported as four passed and one flaky because the readiness page passed on retry;
- workflow invariants, migration safety, Actionlint 1.7.12, ShellCheck 0.10.0, Terraform 1.16.0 fmt/init/validate, dependency audit, Trivy IaC, and Trivy lockfile gates: PASS.
- exact-manifest snapshot scans: Gitleaks scanned about 885 KB with no leaks; Semgrep ran 378 rules over 119 applicable files with zero findings (the Markdown manifest was ignored by Semgrep).

No real AWS request, Terraform plan/apply, staging rollout, or browser signed-URL flow was authorized or executed. The original placeholder-credential failure is covered locally, but live task-role resolution and KMS/S3 authorization remain staging evidence requirements. The release verdict is unchanged: `NO_GO` for production and `STAGING_ONLY` for the next execution phase.

## Playwright readiness-flake remediation on 2026-08-31

The readiness assertion was not timing out in readiness computation or lazy chunk loading. A retry-free repeated walkthrough reproduced the failure after seven passes in a single API lifetime. Trace and browser/network evidence showed the global per-IP throttle first returning 429 for application queries and then the independently capped `/auth/refresh` endpoint returning 429. Because each `page.goto()` is a hard navigation and access tokens are intentionally memory-only, refresh failure left the new document without an access token; `ProtectedRoute` then correctly redirected `/readiness` to `/login`. The readiness page was the observed assertion point, not the failing subsystem.

The root configuration defect was that `THROTTLE_TTL` and `THROTTLE_LIMIT` were validated and documented but ignored by `AppModule`, which hard-coded 100 requests/minute. The patch makes the global throttler honor those variables, adds a separately validated `AUTH_REFRESH_THROTTLE_LIMIT` with the unchanged production default of 60/minute, and gives the Docker Playwright API webServer a test-only limit of 1000 for both counters. This preserves production anti-abuse defaults while accounting for all browser contexts sharing one Docker source IP. No timeout was increased.

Verification against the patched exact-toolchain image:

- initial reproduction: 7/10 passed and 3 failed, retries disabled; failures correlated with HTTP 429 and `/readiness` redirecting to `/login`;
- intermediate global-throttle patch: 7/10 passed and 3 failed, retries disabled; the remaining failures isolated the hard-coded 60/minute refresh decorator;
- final focused walkthrough: PASS — 10/10, retries disabled, trace enabled, one API lifetime;
- full Docker Playwright suite: PASS — 5/5 in 36.1 seconds, retries disabled, including real admin MFA and the interview vertical slice;
- focused environment-validation Jest: PASS — 1 suite, 15 tests;
- full API Jest: PASS — 134 suites, 732 tests;
- API and web TypeScript: PASS;
- contracts build, Prisma generation, API Nest build, Prettier, and `git diff --check`: PASS.
- updated exact-manifest Gitleaks: PASS — approximately 894 KB scanned, no leaks;
- updated exact-manifest Semgrep: PASS — 378 rules, 120 targets, zero findings (the Markdown manifest was ignored).

The 401 refresh responses at the start of fresh unauthenticated browser contexts are expected missing-cookie probes and did not affect any test. No browser page errors or post-patch 429 responses occurred. Local traces remain in ignored Playwright artifact paths and are not candidate source.

The verdict remains `NO_GO` for production and `STAGING_ONLY` for the next execution phase. Candidate-SHA CI, reviewed Terraform plan, live staging AWS S3/KMS task-role evidence, rollback rehearsal, and restore drill are still mandatory.
