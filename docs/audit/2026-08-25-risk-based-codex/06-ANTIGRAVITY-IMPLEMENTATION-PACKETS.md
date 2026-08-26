# Antigravity implementation packets

These 19 packets cover every confirmed P1/P2 finding. They are specifications only; this audit did not invoke Antigravity or change product code. Every packet inherits this safety contract: capture `git status --short --untracked-files=all` before and after; preserve all pre-existing dirty, staged and untracked state; make a minimal patch only inside Allowed scope; never clean/reset/restore/stash/delete; stop on overlap or destructive/database/production action; return the exact diff, commands, exit codes, skipped checks and residual risk. Warnings outside the packet are evidence, not authority for unrelated cleanup.

## AG-PACKET-001 — SEC-001 Unsigned PayOS fallback

- **Priority and dependencies:** P1; none; complete before billing release.
- **Objective:** make every PayOS webhook state change cryptographically authenticated.
- **Current incorrect behavior:** invalid/missing signature can fall through to body parsing and mutate payment state.
- **Required invariant:** no billing mutation unless the configured provider verifier accepts the exact raw payload/signature; uncertainty fails closed.
- **Exact source evidence:** `apps/api/src/modules/billing/webhook.controller.ts:27`; `apps/api/src/modules/billing/providers/payos.provider.ts:33-60,114-122`; `apps/api/src/modules/billing/billing.service.ts:322-539`.
- **Allowed scope:** billing webhook controller/service, PayOS adapter, focused unit/integration tests.
- **Expected files and symbols:** `webhook.controller.ts` handler; `payos.provider.ts` verifier; `billing.service.ts` state transition; existing billing specs.
- **Files that must not be touched:** Stripe flow except shared verifier contract; migrations, infrastructure, unrelated providers.
- **Implementation requirements:** preserve raw body; verify before parse/use; require configured secret; reject missing/invalid/stale/replayed callbacks; idempotently bind provider transaction to local payment.
- **Compatibility constraints:** valid PayOS callbacks and idempotent retries remain accepted; public response semantics must match provider retry expectations.
- **Data/API/frontend implications:** no schema/UI change expected; document any deliberate HTTP status change.
- **Required tests:** valid, missing signature, malformed payload, bad signature, replay, payment-ID mismatch, already-processed retry.
- **Verification commands:** focused billing test command discovered from package scripts; API typecheck; `git diff --check`.
- **Positive behavior:** one verified callback performs one authorized transition.
- **Negative/fail-closed behavior:** unverifiable callback performs zero reads used for authority and zero writes.
- **Rollout and rollback:** deploy behind logging/metric of verification outcome; rollback only to previous signed verifier, never unsigned fallback.
- **Evidence Antigravity must return:** patch, verifier contract, test output, mutation-count evidence for rejection cases.
- **Completion checklist:** all tests pass; raw-body path proven; secrets absent from logs; dirty baseline preserved.
- **Stop conditions:** provider signature algorithm/raw-body contract cannot be confirmed; change would accept unsigned traffic.
- **Non-goals:** billing UI, price changes, provider migration.

## AG-PACKET-002 — SEC-002 Voice WebSocket JWT revalidation

- **Priority and dependencies:** P1; coordinate with gateway/client owners.
- **Objective:** authenticate and continuously authorize the voice WebSocket lifecycle.
- **Current incorrect behavior:** connection accepts incompletely revalidated JWT/session state.
- **Required invariant:** handshake and privileged messages require valid signature, claims, expiry and current user/session authorization.
- **Exact source evidence:** `apps/api/src/modules/voice-gateway/gateways/voice-streaming.gateway.ts:72-101,189-283`; `apps/api/src/modules/auth/strategies/jwt.strategy.ts:25-69`; `apps/api/src/modules/auth/auth.service.ts:106-154`.
- **Allowed scope:** voice gateway/auth helpers, voice client handshake, focused tests.
- **Expected files and symbols:** `voice-streaming.gateway.ts` connection/message guards; shared auth/JWT validation service; voice client.
- **Files that must not be touched:** token issuance/rotation semantics unless separately approved; unrelated gateways.
- **Implementation requirements:** use canonical verifier; reject expired/revoked/wrong-purpose tokens; bind user to requested session; disconnect on failure; avoid token logging.
- **Compatibility constraints:** current valid access-token clients reconnect normally; explicit protocol/version change if query token is replaced.
- **Data/API/frontend implications:** client may need an authenticated handshake frame/subprotocol; no schema change.
- **Required tests:** valid token, tampered token, expired token, revoked/logged-out token, cross-user session, midstream expiry/revalidation failure.
- **Verification commands:** focused voice gateway and client tests; API/web typecheck; `git diff --check`.
- **Positive behavior:** authorized user streams only to their permitted session.
- **Negative/fail-closed behavior:** invalid/ambiguous identity is disconnected before processing audio.
- **Rollout and rollback:** dual-protocol observation only if both paths fully verify; rollback to last fully verified handshake.
- **Evidence Antigravity must return:** protocol diff, test transcript, logs proving no credential exposure.
- **Completion checklist:** canonical verification reused; session binding covered; disconnect behavior tested.
- **Stop conditions:** revocation/session-authority source is unknown; compatibility requires accepting unverified credentials.
- **Non-goals:** speech quality, STT provider selection.

## AG-PACKET-003 — SEC-003 Admin MFA enrollment bypass

- **Priority and dependencies:** P1; identity-owner decision on enrollment policy.
- **Objective:** prevent privileged access before required MFA enrollment and challenge.
- **Current incorrect behavior:** unenrolled admin can bypass the intended MFA gate.
- **Required invariant:** privileged admin capability requires server-enforced enrollment plus recent successful challenge.
- **Exact source evidence:** `apps/api/src/modules/auth/auth.service.ts:168-175,754-796`; `apps/api/src/modules/admin/admin.controller.ts:24-39,61-118`; skill/readiness privileged controllers.
- **Allowed scope:** auth token/enrollment service, privileged controller guards and focused auth tests.
- **Expected files and symbols:** `AuthService` login/token issuance; MFA step-up guard; privileged admin/skill/readiness controllers.
- **Files that must not be touched:** general user MFA/product authorization; seed data.
- **Implementation requirements:** explicit enrollment state; least-privilege enrollment session; deny admin endpoints until challenge; recovery path audited/rate-limited.
- **Compatibility constraints:** existing enrolled admins remain valid; emergency access requires a separately approved, auditable mechanism.
- **Data/API/frontend implications:** frontend may need an enrollment-required state; migration only if existing state cannot represent it.
- **Required tests:** unenrolled login, enrollment token privilege, enrolled/no challenge, valid challenge, replay, expired recovery.
- **Verification commands:** focused admin auth tests; API typecheck; migration check if applicable; `git diff --check`.
- **Positive behavior:** enrolled/challenged admin reaches authorized endpoints.
- **Negative/fail-closed behavior:** all incomplete/unknown MFA states return denial without privileged token.
- **Rollout and rollback:** inventory existing admins; staged enforcement with audited enrollment; never rollback to bypass.
- **Evidence Antigravity must return:** state machine, test matrix/output, migration/rollback evidence if used.
- **Completion checklist:** guard covers every admin route; recovery audited; no secret logged.
- **Stop conditions:** admin ownership/state cannot be established; destructive credential migration required.
- **Non-goals:** redesigning the admin console.

## AG-PACKET-004 — SEC-012 Server-side logout revocation

- **Priority and dependencies:** P1; depends on chosen revocation/session model.
- **Objective:** make UI logout invalidate server-side refresh/session authority.
- **Current incorrect behavior:** navbar logout removes local state only although an API logout endpoint exists.
- **Required invariant:** user logout revokes server session/refresh authority before local caches are considered cleared.
- **Exact source evidence:** `apps/web/src/components/layout/Navbar.tsx:92-95`; `apps/web/src/stores/auth.store.ts:81-85`; `apps/api/src/modules/auth/auth.controller.ts:57-63`; `auth.service.ts:281-301`.
- **Allowed scope:** logout API client/store/navbar, auth endpoint tests.
- **Expected files and symbols:** auth API logout call; auth store `logout`; navbar action; auth tests.
- **Files that must not be touched:** login UI, unrelated navigation, token lifetime policy.
- **Implementation requirements:** call authenticated logout; handle retry/idempotency; clear local auth and user-scoped caches after server result or explicit safe failure policy; prevent silent success telemetry.
- **Compatibility constraints:** logout remains responsive offline with visible/recorded revocation-pending semantics.
- **Data/API/frontend implications:** frontend behavior only unless endpoint response needs a backward-compatible clarification.
- **Required tests:** success, already revoked, network failure, 401, double click, refresh token reuse after logout.
- **Verification commands:** focused web auth/store tests; API auth test; typechecks; `git diff --check`.
- **Positive behavior:** successful logout makes old refresh/session credential unusable.
- **Negative/fail-closed behavior:** UI does not claim durable server logout when revocation is unconfirmed.
- **Rollout and rollback:** observe revocation failures; rollback only UI orchestration, retaining server revocation.
- **Evidence Antigravity must return:** client/server trace and test proving credential reuse rejected.
- **Completion checklist:** endpoint invoked once/idempotently; caches handled; dirty baseline preserved.
- **Stop conditions:** endpoint semantics cannot be determined; fix would expose token or weaken revocation.
- **Non-goals:** global device/session management.

## AG-PACKET-005 — PRIV-001 Cross-account PWA/query cache isolation

- **Priority and dependencies:** P1; coordinate with SEC-012 logout flow.
- **Objective:** prevent authenticated responses and query data crossing account boundaries.
- **Current incorrect behavior:** Workbox caches authenticated flashcards and singleton QueryClient/account-agnostic keys survive account changes.
- **Required invariant:** private cached state is keyed by verified account and purged on logout/account transition; service worker never shares authenticated API bodies across users.
- **Exact source evidence:** `apps/web/vite.config.ts:50-55`; `apps/web/src/hooks/useFlashcards.ts:21-51`; `apps/web/src/features/profile/ProfilePage.tsx:55`; `apps/web/src/App.tsx:40-48`.
- **Allowed scope:** Vite/Workbox runtime caching, QueryClient lifecycle/key factories, logout integration, focused tests.
- **Expected files and symbols:** `vite.config.ts` Workbox config; `App.tsx` QueryClient; auth transition; private query keys.
- **Files that must not be touched:** public static asset cache, API data model, unrelated UI.
- **Implementation requirements:** exclude authenticated/private API routes from shared Cache Storage or partition safely; clear/cancel queries and private browser storage on identity change; enumerate private keys.
- **Compatibility constraints:** offline public assets remain; do not cache secrets/tokens; upgrades clean legacy private caches.
- **Data/API/frontend implications:** possible offline behavior reduction for private flashcards must be explicit.
- **Required tests:** user A→logout→B, service-worker cache inspection, stale in-flight response, reload/offline, cache upgrade cleanup.
- **Verification commands:** focused QueryProvider/auth tests; PWA build/config inspection; browser integration; typecheck; `git diff --check`.
- **Positive behavior:** same-user navigation retains permitted cache benefits.
- **Negative/fail-closed behavior:** identity ambiguity yields empty private cache, never previous-user data.
- **Rollout and rollback:** version cache names and delete only exact legacy app caches; rollback must retain isolation.
- **Evidence Antigravity must return:** enumerated cache names/keys, browser trace, A/B isolation test output.
- **Completion checklist:** all private routes classified; logout/account switch purges; public cache unaffected.
- **Stop conditions:** cleanup target is wildcard/ambiguous; operation risks unrelated browser/user data.
- **Non-goals:** general performance tuning.

## AG-PACKET-006 — FUNC-001 Non-text mock output cannot become authority

- **Priority and dependencies:** P1; owner must define permitted dev/test modes.
- **Objective:** stop mock storage/vision outputs from becoming authoritative production records.
- **Current incorrect behavior:** storage defaults to mock metadata and vision falls back to a fixed 8.5 score, then persists results without provenance/authority.
- **Required invariant:** production-required provider absence/failure is explicit and fail-closed; any non-production mock is visibly non-authoritative and cannot drive durable scores/assets.
- **Exact source evidence:** `apps/api/src/modules/storage/storage.module.ts:26-35`; `storage/providers/mock-storage.provider.ts:38-47`; `storage.service.ts:53-86`; `apps/api/src/modules/system-design/system-design.module.ts:29-52`; `providers/mock-vision.provider.ts:68-81`; `services/design-evaluation.service.ts:64-89`.
- **Allowed scope:** storage/vision provider configuration, persistence boundary, DTO/provenance if needed, focused tests.
- **Expected files and symbols:** storage provider selection/confirm; system-design vision provider/evaluation persistence; environment validation; related specs.
- **Files that must not be touched:** text-AI router verified fix; existing stored records without an approved migration.
- **Implementation requirements:** explicit mode allowlist; production startup/config validation; typed unavailable result; provenance/authority on persisted analysis or no persistence; no fixed score fallback.
- **Compatibility constraints:** deterministic mocks remain available in tests/local opt-in only.
- **Data/API/frontend implications:** API may expose unavailable/non-authoritative status; schema change requires compatible migration and owner approval.
- **Required tests:** production missing provider, provider timeout/error/malformed response, local explicit mock, persistence denial, UI unavailable state.
- **Verification commands:** focused storage/vision tests; config validation tests; API/web typecheck; `git diff --check`.
- **Positive behavior:** verified provider result persists with provenance.
- **Negative/fail-closed behavior:** missing/untrusted result cannot create asset authority or score.
- **Rollout and rollback:** inventory mock-derived records before any remediation; rollback retains fail-closed production guard.
- **Evidence Antigravity must return:** mode matrix, persistence assertions, focused outputs and data compatibility note.
- **Completion checklist:** no implicit mock default; production guard tested; user-visible failure defined.
- **Stop conditions:** historical data mutation required; provider contract unknown.
- **Non-goals:** choosing new storage/vision vendors.

## AG-PACKET-007 — REL-001 Durable async handoff

- **Priority and dependencies:** P1; architecture decision: outbox/reconciler/idempotent state machine.
- **Objective:** guarantee eventual queue handoff after committed answer/evaluation state.
- **Current incorrect behavior:** answer transaction commits before queue add; add failure is swallowed. Evaluation is marked COMPLETED before learning-path enqueue, while retry skips terminal state.
- **Required invariant:** every committed handoff intent is durably discoverable and eventually executed exactly-once in effect.
- **Exact source evidence:** `apps/api/src/modules/interview/interview.service.ts:365-420`; `apps/api/src/modules/evaluation/evaluation.processor.ts:85-91,226-250,371-439`.
- **Allowed scope:** interview/evaluation transaction state, queue producers/processors, reconciler/outbox, migrations and focused tests if explicitly approved.
- **Expected files and symbols:** answer submit transaction; evaluation processor terminal transition; queue enqueue helpers; new outbox/reconciliation symbols.
- **Files that must not be touched:** scoring algorithm, provider prompts, unrelated queues.
- **Implementation requirements:** atomic intent; deterministic idempotency key; retry/backoff/dead-letter/visibility; reconciler metric; terminal state reflects downstream completion accurately.
- **Compatibility constraints:** duplicate delivery must be safe; existing jobs/records remain processable.
- **Data/API/frontend implications:** possible intermediate status/backward-compatible schema migration; UI polling must tolerate it.
- **Required tests:** commit+enqueue success, enqueue failure, worker crash each boundary, duplicate/replay, reconciler recovery, terminal retry.
- **Verification commands:** focused interview/evaluation/queue integration tests; migration validation; API typecheck; `git diff --check`.
- **Positive behavior:** intent reaches downstream once in effect despite retries.
- **Negative/fail-closed behavior:** system never silently reports full completion with undiscoverable missing work.
- **Rollout and rollback:** migrate additively; deploy consumers before producers; rollback leaves durable intents readable.
- **Evidence Antigravity must return:** failure-injection trace, state diagram, idempotency proof, migration/rollback output.
- **Completion checklist:** all crash points tested; alertable backlog metric; no swallowed enqueue failure.
- **Stop conditions:** destructive migration/data reset; queue semantics cannot be reproduced.
- **Non-goals:** wholesale queue replacement.

## AG-PACKET-008 — OPS-001 Production artifact/runtime contract

- **Priority and dependencies:** P1; deployment owner must confirm canonical entrypoints and secret sources.
- **Objective:** produce one bootable, consistently configured API/worker artifact across Docker, Compose and Terraform.
- **Current incorrect behavior:** build copies `apps/api/dist` to `/app/apps/api/dist` but commands point at `/app/dist/*`; Terraform uses another worker path; ECS lacks required JWT settings; DB and Redis connection contracts mismatch.
- **Required invariant:** immutable artifact paths, entrypoints and required configuration are identical and verified before release.
- **Exact source evidence:** `apps/api/Dockerfile:35,46`; `docker-compose.yml:55-83`; `infra/terraform/modules/compute/main.tf:176-218`; `infra/terraform/modules/database/main.tf:45-54`; `infra/terraform/modules/redis/main.tf:30-38`; `apps/api/src/config/env.validation.ts:12-35`.
- **Allowed scope:** Dockerfile, compose service definitions, Terraform compute wiring, config validation, CI smoke test.
- **Expected files and symbols:** API/worker image stages/commands; task definitions/env-secret maps; health startup commands.
- **Files that must not be touched:** live infrastructure/state, databases, secrets values, unrelated modules.
- **Implementation requirements:** choose canonical dist layout; validate API and worker entrypoints; source all required secrets; construct credentialed DB URL; align Redis TLS/auth; remove production+mock contradiction.
- **Compatibility constraints:** no secret in image/log/plan; Terraform change plan must be reviewed, not applied by packet.
- **Data/API/frontend implications:** none intended; configuration contract documentation update allowed.
- **Required tests:** local image build, API container boot, worker container boot, config-negative tests, Terraform validate/plan (no apply).
- **Verification commands:** repository-defined build; `docker build` and bounded container smoke where available; `terraform fmt -check`/`validate`; `git diff --check`.
- **Positive behavior:** same digest boots both intended entrypoints with complete configuration.
- **Negative/fail-closed behavior:** missing/malformed secret or incompatible Redis/DB config blocks startup clearly.
- **Rollout and rollback:** publish new immutable tag; canary tasks; retain prior known-good tag/task definition.
- **Evidence Antigravity must return:** image paths, boot logs, config matrix, redacted plan, rollback tag.
- **Completion checklist:** API/worker smoke green; no secret leakage; no apply/deploy executed.
- **Stop conditions:** requires production mutation/secret read; canonical path or runtime contract unresolved.
- **Non-goals:** provisioning infrastructure or changing capacity.

## AG-PACKET-009 — CI-001 Release gates exercise deployable system

- **Priority and dependencies:** P1; depends on OPS-001 contract.
- **Objective:** make CI prove required configuration, API integration and deployable images.
- **Current incorrect behavior:** Playwright API boot lacks mandatory JWT secrets; API integration suite is not explicitly invoked; no image build/start smoke.
- **Required invariant:** required release checks run with safe ephemeral config and fail if deployable API/worker cannot boot.
- **Exact source evidence:** `.github/workflows/ci.yml:80-185`; `apps/api/src/config/env.validation.ts:12-35`; root/package scripts.
- **Allowed scope:** CI workflow, package test scripts/config, test-only env fixtures, bounded smoke scripts.
- **Expected files and symbols:** CI jobs for integration/E2E/image smoke; package scripts; test env setup.
- **Files that must not be touched:** production secrets/environments, branch protections, unrelated application behavior.
- **Implementation requirements:** explicit suite invocation; ephemeral JWT secrets/services; image build and both entrypoint smoke; artifact/log retention; timeouts and deterministic cleanup handled by CI runner.
- **Compatibility constraints:** no real external provider/production dependency; secrets redacted; existing unit/type/lint gates retained.
- **Data/API/frontend implications:** disposable test database only, explicitly identified; no destructive command against unspecified DB.
- **Required tests:** workflow validation; intentional missing-config failure; API integration discovery/count; API+worker smoke; E2E readiness.
- **Verification commands:** local workflow/script dry runs where available; package focused commands; Docker smoke; `git diff --check`.
- **Positive behavior:** valid ephemeral stack passes all named gates.
- **Negative/fail-closed behavior:** missing suite, config or boot readiness fails the job.
- **Rollout and rollback:** introduce observable required jobs before protection change; rollback preserves last effective gates.
- **Evidence Antigravity must return:** exact discovered test counts, job logs, image smoke logs, skipped checks.
- **Completion checklist:** integration explicitly named; both entrypoints boot; no production contact; durations bounded.
- **Stop conditions:** environment cannot be proven disposable; workflow needs external secrets not approved.
- **Non-goals:** full CI redesign or broad test expansion.

## AG-PACKET-010 — SEC-004 Behavioral-answer report BOLA

- **Priority and dependencies:** P2; authorization owner confirms mentor/admin roles.
- **Objective:** scope behavioral answer/report reads to owner or explicitly authorized actor.
- **Current incorrect behavior:** object lookup can expose another user's report without a complete ownership/relationship check.
- **Required invariant:** every object read verifies authenticated subject against current object ownership/role relation server-side.
- **Exact source evidence:** `apps/api/src/modules/interview/behavioral/behavioral.controller.ts:50-54`; `behavioral.service.ts:72-135`.
- **Allowed scope:** behavioral controller/service authorization queries and tests.
- **Expected files and symbols:** report/answer retrieval handlers and repository predicates.
- **Files that must not be touched:** scoring content, public-share feature, unrelated roles.
- **Implementation requirements:** authorize before response; include tenant/user predicate in query where possible; indistinguishable not-found/forbidden policy; admin/mentor scope explicit.
- **Compatibility constraints:** owners retain access; avoid existence leak.
- **Data/API/frontend implications:** unauthorized status may standardize to 404/403; no schema expected.
- **Required tests:** owner, other user, authorized mentor, unrelated mentor, admin policy, missing object.
- **Verification commands:** focused behavioral authorization tests; API typecheck; `git diff --check`.
- **Positive behavior:** authorized relationship receives only scoped object.
- **Negative/fail-closed behavior:** unknown relationship returns no content/metadata.
- **Rollout and rollback:** monitor denial rates; rollback only to an equally scoped predicate.
- **Evidence Antigravity must return:** access matrix, query predicate diff, test output.
- **Completion checklist:** every route covered; enumeration resisted; dirty state preserved.
- **Stop conditions:** role policy ambiguous enough to broaden access.
- **Non-goals:** behavioral model redesign.

## AG-PACKET-011 — SEC-005 Storage object ownership registry

- **Priority and dependencies:** P2; storage/data owner decides legacy-object treatment.
- **Objective:** allow file access only through registered ownership/authorization metadata.
- **Current incorrect behavior:** object key can be used without proving it belongs to the requesting user/domain record.
- **Required invariant:** requested key resolves to a registered FileAsset (or equivalent) whose owner and purpose authorize the action.
- **Exact source evidence:** `apps/api/src/modules/storage/storage.service.ts:28-86,113-152`; `apps/api/src/modules/storage/providers/s3-storage.provider.ts:65-84`.
- **Allowed scope:** storage controller/service, FileAsset queries, URL signing, tests.
- **Expected files and symbols:** upload/download/delete/sign handlers; ownership lookup.
- **Files that must not be touched:** bucket contents, live object lifecycle, unrelated schemas without approval.
- **Implementation requirements:** normalize key; require registry record; enforce owner/purpose/state; generate short-lived scoped access; audit denial without logging sensitive URL.
- **Compatibility constraints:** legitimate legacy records require explicit migration/quarantine plan, never implicit allow.
- **Data/API/frontend implications:** legacy unregistered keys may become inaccessible; surface controlled error.
- **Required tests:** owner, other user, unregistered key, encoded key, expired/deleted asset, authorized domain delegate.
- **Verification commands:** focused storage auth tests; API typecheck; `git diff --check`.
- **Positive behavior:** owner gets bounded access to registered object.
- **Negative/fail-closed behavior:** absent/ambiguous registry record yields no signed URL/content.
- **Rollout and rollback:** inventory only first; migrate additively with approval; rollback retains ownership check.
- **Evidence Antigravity must return:** legacy inventory method, auth matrix, signed-URL assertions.
- **Completion checklist:** all storage actions scoped; sensitive URL absent from logs.
- **Stop conditions:** requires deleting/moving objects or guessing legacy ownership.
- **Non-goals:** storage vendor migration.

## AG-PACKET-012 — SEC-006 Mentor score-override scope

- **Priority and dependencies:** P2; mentor-assignment policy is prerequisite.
- **Objective:** limit score overrides to authorized mentor-session relationships.
- **Current incorrect behavior:** mentor role alone can override an insufficiently scoped target.
- **Required invariant:** override requires active assignment to the specific candidate/session plus auditable reason and bounds.
- **Exact source evidence:** `apps/api/src/modules/mentor/controllers/live-session.controller.ts:47-61`; `apps/api/src/modules/mentor/services/live-session.service.ts:156-277`.
- **Allowed scope:** mentor override controller/service, assignment query, audit event and focused tests.
- **Expected files and symbols:** score override handler; assignment authorization; audit record.
- **Files that must not be touched:** base scoring algorithm, unrelated mentor features.
- **Implementation requirements:** atomic scoped predicate; validate reason/range; record actor/target/old/new/time; concurrency handling.
- **Compatibility constraints:** existing authorized mentor workflows remain; admins only if policy explicitly permits.
- **Data/API/frontend implications:** reason may become required; audit schema change needs additive migration.
- **Required tests:** assigned/unassigned mentor, expired assignment, other session, invalid range, concurrent override, audit completeness.
- **Verification commands:** focused mentor tests; migration validation if used; API typecheck; `git diff --check`.
- **Positive behavior:** assigned mentor performs one bounded, audited override.
- **Negative/fail-closed behavior:** role without relationship cannot mutate score.
- **Rollout and rollback:** deploy audit/read path before enforcement if migration required; never rollback to role-only authority.
- **Evidence Antigravity must return:** policy matrix, transactional test output, audit example with redaction.
- **Completion checklist:** scoped query; reason/bounds; concurrency and audit covered.
- **Stop conditions:** assignment source or admin policy unresolved.
- **Non-goals:** recalibrating scores.

## AG-PACKET-013 — SEC-007 Bounded Judge0 fan-out

- **Priority and dependencies:** P2; product owner defines limits/quotas.
- **Objective:** bound code-execution resource amplification per request/user/session.
- **Current incorrect behavior:** attacker-controlled test collection can cause unbounded Judge0 submissions/work.
- **Required invariant:** validated maximum input size/test count/concurrency/cost enforced before any external execution.
- **Exact source evidence:** `apps/api/src/modules/code-execution/dto/code-execution.dto.ts:14-34`; `providers/judge0.provider.ts:80-167`; `code-execution.service.ts:50-81`.
- **Allowed scope:** coding DTO/service limits, rate/quota controls, focused tests/metrics.
- **Expected files and symbols:** submission validation; Judge0 dispatch loop/batch; per-user limiter.
- **Files that must not be touched:** Judge0 infrastructure or grading semantics beyond limits.
- **Implementation requirements:** hard caps; payload/time/memory bounds; concurrency control; cancel/timeout; cost/denial metrics; reject duplicates if appropriate.
- **Compatibility constraints:** limits versioned/documented; normal interview fixtures remain accepted.
- **Data/API/frontend implications:** return structured limit error; UI may pre-validate.
- **Required tests:** boundary, over-limit, huge case, concurrent requests, timeout, partial provider failure, quota reset.
- **Verification commands:** focused coding tests; API typecheck; bounded load test only in local mock; `git diff --check`.
- **Positive behavior:** permitted suite executes within bounded concurrency.
- **Negative/fail-closed behavior:** over-limit request submits zero external jobs.
- **Rollout and rollback:** observe near-limit metrics; adjust config within owner-approved ceiling, not remove cap.
- **Evidence Antigravity must return:** limits table, mock submission count assertions, latency/resource evidence.
- **Completion checklist:** pre-dispatch validation; limiter tested; errors documented.
- **Stop conditions:** test contacts paid/production provider without approval.
- **Non-goals:** grader replacement.

## AG-PACKET-014 — SEC-008 Secret-bearing share URL logging

- **Priority and dependencies:** P2; observability owner inventories sinks/retention.
- **Objective:** prevent share tokens/passcodes/secret URLs entering logs.
- **Current incorrect behavior:** secret-bearing share URL/context can be serialized in application logs.
- **Required invariant:** logs contain stable non-secret identifiers and outcome only; credentials/tokens/passcodes are redacted at source and sink.
- **Exact source evidence:** `apps/api/src/modules/share/public-share.controller.ts:13-18`; `apps/api/src/modules/platform/interceptors/logging.interceptor.ts:48-51,74-96`; `apps/api/src/app.module.ts:82-85`.
- **Allowed scope:** share logging fields, central redaction helper/config, focused tests.
- **Expected files and symbols:** share URL generation/logging; logger serializer/redactor.
- **Files that must not be touched:** token entropy/URL behavior unless required separately; external log ACL.
- **Implementation requirements:** remove raw URL/token/passcode; structured allowlist; recursive redaction; regression test; assess rotation of exposed tokens separately.
- **Compatibility constraints:** retain correlation by non-secret share ID; no sensitive value in errors.
- **Data/API/frontend implications:** none.
- **Required tests:** logger capture for create/access/error with URL, query, nested object and encoded credential.
- **Verification commands:** focused share/log tests; repository search for secret URL logging; API typecheck; `git diff --check`.
- **Positive behavior:** operations correlate by safe ID.
- **Negative/fail-closed behavior:** serializer drops unknown sensitive fields rather than emitting them.
- **Rollout and rollback:** deploy redaction first; owner decides token rotation/log purge under separate authorized procedure.
- **Evidence Antigravity must return:** before/after field schema, captured logs proving absence, search results.
- **Completion checklist:** source and central defense; errors covered; no log deletion attempted.
- **Stop conditions:** asks to delete logs or rotate production credentials without exact authorization.
- **Non-goals:** log-platform retention changes.

## AG-PACKET-015 — REL-002 Interview progress SSE delivery

- **Priority and dependencies:** P2; choose authenticated transport and shared event backbone.
- **Objective:** deliver authorized progress events across API/worker replicas with reliable fallback.
- **Current incorrect behavior:** browser EventSource sends no bearer while API expects bearer; in-process Subject does not cross worker/API processes.
- **Required invariant:** authenticated client receives only its events regardless of emitting replica/process, with resumable or explicit polling fallback.
- **Exact source evidence:** `apps/web/src/hooks/use-interview-sse.ts:47-89`; `apps/api/src/modules/auth/strategies/jwt.strategy.ts:15-17`; `apps/api/src/modules/platform/sse/sse.service.ts:13-30`; `apps/api/src/modules/evaluation/evaluation.processor.ts:306`; `interview.controller.ts:134-143`.
- **Allowed scope:** SSE endpoint/auth transport, shared pub/sub/event persistence, client hook, focused tests.
- **Expected files and symbols:** interview SSE hook; platform SSE controller/service; worker emit; auth guard.
- **Files that must not be touched:** evaluation scoring, unrelated WebSockets.
- **Implementation requirements:** supported browser auth mechanism without URL token leakage; user/session channel authorization; Redis/durable bus; event IDs/reconnect; retain bounded polling fallback.
- **Compatibility constraints:** multi-replica and worker isolation; no token in URL/log; degraded polling remains correct.
- **Data/API/frontend implications:** event envelope/version may change backward-compatibly.
- **Required tests:** auth success/failure, cross-user, emitter different process, reconnect/duplicate/order, bus outage, polling convergence.
- **Verification commands:** focused API/web tests; multi-process local integration; typechecks; `git diff --check`.
- **Positive behavior:** authorized event emitted by worker reaches correct client once in effect.
- **Negative/fail-closed behavior:** unauthenticated/cross-user subscription receives no event metadata.
- **Rollout and rollback:** feature flag transport; polling is safe fallback; rollback disables stream, not authorization.
- **Evidence Antigravity must return:** topology trace, reconnect test, auth matrix, fallback evidence.
- **Completion checklist:** cross-process proven; no URL token; user isolation tested.
- **Stop conditions:** transport requires credential leakage or production broker mutation.
- **Non-goals:** replacing all realtime features.

## AG-PACKET-016 — REL-003 Processor and cron role separation

- **Priority and dependencies:** P2; deployment role contract from OPS-001.
- **Objective:** ensure processors/schedulers run only in intended roles and once where required.
- **Current incorrect behavior:** API and worker both boot AppModule, registering processors/ScheduleModule; multiple replicas can duplicate reminders and consume unbounded serial queries.
- **Required invariant:** HTTP, worker and singleton-scheduler capabilities are explicitly separated; scheduled work is idempotent/locked and bounded.
- **Exact source evidence:** `apps/api/src/main.ts:12`; `apps/api/src/worker.ts:9`; `apps/api/src/app.module.ts:54-75`; `apps/api/src/modules/notifications/notification.module.ts:8-10`; `streak-reminder.cron.ts:18-48`; Terraform replica counts.
- **Allowed scope:** module composition/role flags, scheduler lock/idempotency, reminder batching, tests and deployment commands.
- **Expected files and symbols:** API/worker bootstrap modules; notification module/cron; processor registration.
- **Files that must not be touched:** notification copy/preferences semantics, live replica counts/apply.
- **Implementation requirements:** role-specific module graph; distributed lock or idempotent claim; pagination/batching; retry-safe send ledger; role startup assertion.
- **Compatibility constraints:** existing queued jobs process; zero double-sends across replicas; one role loss recoverable.
- **Data/API/frontend implications:** optional delivery claim state requires additive migration.
- **Required tests:** API boots no processors/cron; worker expected processors; two scheduler replicas; crash/retry; large paginated user set.
- **Verification commands:** focused module/cron tests; API and worker boot smoke; migration validation; `git diff --check`.
- **Positive behavior:** intended role performs bounded idempotent work.
- **Negative/fail-closed behavior:** wrong/unknown role refuses duplicate capability registration.
- **Rollout and rollback:** deploy role-aware artifact then task definitions; retain compatible old consumers during drain.
- **Evidence Antigravity must return:** module graph, two-replica test, query/send counts, boot logs.
- **Completion checklist:** roles explicit; singleton semantics proven; batching bounded.
- **Stop conditions:** needs live deployment change or destructive queue drain.
- **Non-goals:** notification feature redesign.

## AG-PACKET-017 — PRIV-002 Enforced privacy lifecycle

- **Priority and dependencies:** P2; legal/product/data owners must approve retention and deletion semantics.
- **Objective:** enforce documented retention, export and deletion across all personal-data domains.
- **Current incorrect behavior:** voice 30-day purge is documented but not modeled/enforced; CV expiry is not consistently filtered; no account-deletion endpoint; “complete” export omits many user relations.
- **Required invariant:** each personal-data class has authoritative retention/export/delete policy enforced and auditable end-to-end.
- **Exact source evidence:** `docs/features/F001-VOICE-REALTIME-INTERVIEW.md:209-214`; `apps/api/prisma/schema.prisma:74-103,1060-1091`; `document-parser.service.ts:46-60,197-221`; `profile.controller.ts:15-39`; `profile.service.ts:314-340`.
- **Allowed scope:** policy inventory/docs, additive expiry/deletion state, scoped jobs/services/endpoints and tests after owner approval.
- **Expected files and symbols:** voice/CV lifecycle queries; export aggregator; account deletion workflow; retention job/metrics.
- **Files that must not be touched:** existing user data by implementation packet; production buckets/databases; backups.
- **Implementation requirements:** data map; explicit clocks/legal holds; expired-read denial; comprehensive export manifest; staged deletion/anonymization; idempotency/audit; backup limitation disclosure.
- **Compatibility constraints:** additive/reversible rollout; no silent loss; statutory/contractual holds override deletion transparently.
- **Data/API/frontend implications:** schemas/endpoints/UI status likely change; version and document them.
- **Required tests:** boundary times/timezones, hold, retry/crash, complete relation manifest, expired CV denial, deletion state machine, unauthorized request.
- **Verification commands:** focused lifecycle/export tests on explicitly disposable fixtures; migration validate only; API/web typecheck; `git diff --check`.
- **Positive behavior:** verified subject request returns complete manifest and reaches policy-compliant state.
- **Negative/fail-closed behavior:** expired/restricted data is not served; uncertain ownership does not delete/export.
- **Rollout and rollback:** inventory/dry-run/report first; additive state; human-approved production procedure separate.
- **Evidence Antigravity must return:** approved data map, fixture manifest diff, lifecycle tests, migration/rollback plan.
- **Completion checklist:** owner approvals recorded; every User relation classified; metrics/audit present; no real data mutation.
- **Stop conditions:** retention policy unresolved; any command would delete/alter real data.
- **Non-goals:** executing production deletion, backup erasure or legal-policy invention.

## AG-PACKET-018 — OPS-002 Readiness and worker observability

- **Priority and dependencies:** P2; depends on deployment topology/monitoring ownership.
- **Objective:** route traffic only to ready API tasks and expose worker health/metrics to a real scraper/alert path.
- **Current incorrect behavior:** load balancer/container health uses liveness while readiness checks DB/Redis; worker metrics are process-local without HTTP scrape; alert wiring is unproven.
- **Required invariant:** traffic readiness reflects critical dependencies; each worker exposes/sends health and metrics through an authenticated, monitored path with actionable alerts.
- **Exact source evidence:** `apps/api/src/modules/platform/health/health.controller.ts:31-53`; `apps/api/Dockerfile:43-44`; Terraform compute health `:130-140`; `apps/api/src/modules/platform/metrics/metrics.service.ts:31-39`; `worker.ts:9-13`; Prometheus rules `:48-67`.
- **Allowed scope:** health endpoints/probes, worker metrics endpoint/exporter, Terraform monitor definitions, focused tests/validate.
- **Expected files and symbols:** `/health/live`, `/health/ready`; API/worker command health; metrics registry/server/exporter; alarms.
- **Files that must not be touched:** live monitoring resources/apply, capacity/autoscaling policy unless separately approved.
- **Implementation requirements:** distinct probe semantics; bounded dependency timeout; worker liveness/readiness; scrape discovery/auth; queue failure/backlog/job-age alerts and runbook links.
- **Compatibility constraints:** liveness must not restart for transient dependency loss; metrics cannot expose PII/secrets.
- **Data/API/frontend implications:** operational endpoints only.
- **Required tests:** dependency healthy/down/timeout; probe route choice; worker metrics scrape; stalled queue alert expression; multi-replica labels.
- **Verification commands:** focused health/metrics tests; API/worker smoke; Terraform validate/plan no apply; `git diff --check`.
- **Positive behavior:** ready task receives traffic and worker telemetry is collected.
- **Negative/fail-closed behavior:** dependency-unready API is removed from traffic; missing worker telemetry alerts.
- **Rollout and rollback:** canary probe thresholds; retain liveness endpoint; rollback target-group path only to verified safe probe.
- **Evidence Antigravity must return:** probe truth table, scrape sample, redacted plan, alert evaluation/test.
- **Completion checklist:** live/ready distinct; worker observable; alerts owned/runbook-linked.
- **Stop conditions:** requires applying infrastructure or weakening endpoint authentication.
- **Non-goals:** general dashboard redesign.

## AG-PACKET-019 — A11Y-001 Keyboard and modal semantics

- **Priority and dependencies:** P2; design owner confirms focus behavior.
- **Objective:** make whiteboard interactions and critical dialogs keyboard/screen-reader operable.
- **Current incorrect behavior:** whiteboard uses clickable `div`; critical overlays are not dialogs; shared Modal lacks focus trap/open/restore and title association.
- **Required invariant:** all interactive elements are semantic/keyboard operable; modal opens with labelled focus, traps it, closes by defined actions and restores focus.
- **Exact source evidence:** `apps/web/src/features/system-design/WhiteboardRoom.tsx:277-291`; `components/share/ShareSessionModal.tsx:71`; `components/billing/VietQrCheckoutModal.tsx:52`; `features/mentor/components/ScoreOverrideModal.tsx:61`; `components/ui/Modal.tsx:24-75`.
- **Allowed scope:** shared accessible dialog primitive, listed consumers, whiteboard controls and focused tests.
- **Expected files and symbols:** `Modal`; three critical modal consumers; whiteboard selectable controls.
- **Files that must not be touched:** visual redesign, unrelated components, business/API logic.
- **Implementation requirements:** native button or complete keyboard semantics; visible focus; `aria-labelledby`/description; initial/trapped/restored focus; Escape policy; background inert; no nested-dialog regression.
- **Compatibility constraints:** pointer/touch behavior and responsive layout remain; destructive confirmation cannot be accidentally submitted.
- **Data/API/frontend implications:** none.
- **Required tests:** RTL user-event keyboard; axe; Tab/Shift+Tab/Escape/restore; screen-reader names; whiteboard keyboard selection/activation.
- **Verification commands:** focused component tests; web typecheck/lint; browser keyboard smoke; `git diff --check`.
- **Positive behavior:** keyboard user completes each critical flow with stable focus.
- **Negative/fail-closed behavior:** focus never escapes to actionable background; noninteractive element is not exposed as control.
- **Rollout and rollback:** migrate consumers incrementally behind shared compatible API; rollback individual consumer only if shared guarantees remain.
- **Evidence Antigravity must return:** accessibility tree/axe output, keyboard trace, screenshots only as supplemental evidence.
- **Completion checklist:** all listed consumers migrated; focus assertions pass; no pointer regression.
- **Stop conditions:** change would alter payment/score business semantics or needs broad redesign.
- **Non-goals:** full-site WCAG certification.
