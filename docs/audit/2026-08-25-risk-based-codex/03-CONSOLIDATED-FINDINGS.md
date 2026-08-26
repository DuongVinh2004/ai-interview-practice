# 03 — Consolidated Findings

Canonical security details: [Security Scan Index](security/SECURITY-SCAN-INDEX.md). Priority ở đây là release priority, không đồng nhất máy móc với canonical severity. Tổng: **0 P0, 9 P1, 10 P2, 5 P3**, cộng 3 `VERIFIED_FIXED` và rejected candidates.

## P1 — Must fix before release

### SEC-001 — PayOS unsigned fallback grants paid entitlement

- **Status/classification/confidence:** CONFIRMED; security/billing integrity; P1/high; high.
- **Invariant:** chỉ callback PayOS có chữ ký, khớp order/amount/currency/open state và chưa xử lý mới active subscription.
- **Actual/trigger:** public route `apps/api/src/modules/billing/webhook.controller.ts:27` nhận body; thiếu/mock credentials hoặc SDK init fail chuyển sang mock (`payos.provider.ts:33-60`) và trả unsigned `body.data` (`:114-122`). User tạo pending order/invoice (`billing.service.ts:322-403`), rồi forged `code=00` tới transaction active subscription/PAID invoice (`:406-539`).
- **Root cause/workflow/impact:** production provider policy không fail closed; billing checkout→webhook→entitlement có thể cấp paid plan không thanh toán, corrupt ledger và emit receipt.
- **Controls/counterevidence:** configured SDK verifies; pending invoice và success code được kiểm tra. Chúng giới hạn target nhưng không authenticate fallback; amount/state/idempotency chưa bound.
- **Validation/fix/tests/DoD:** static source-to-sink + independent scan. Disable/fail startup PayOS khi prod config thiếu; verify trước parse; atomic compare-and-set OPEN→PAID. Tests: unsigned/wrong amount/replay fail; valid signed callback exactly once. DoD: không side effect trước verified/idempotent transaction.

### SEC-002 — Voice WebSocket bypasses MFA/revocation/current role

- **Status/classification/confidence:** CONFIRMED; authentication; P1/high; high.
- **Invariant:** mọi transport chỉ nhận access token, reject `mfaPending`, locked/deleted/tokenVersion mismatch, dùng current DB role.
- **Actual/trigger:** gateway raw-verifies token (`voice-streaming.gateway.ts:72-101`, `:189-211`) thay vì controls trong `jwt.strategy.ts:25-69`, rồi dùng `sub`/embedded ADMIN để mở interview/voice providers (`voice-streaming.gateway.ts:213-283`). MFA challenge được issue sau password (`auth.service.ts:106-154`).
- **Root cause/workflow/impact:** duplicated transport auth. Password-only attacker dùng challenge token với voice của victim; stale/revoked token tiếp tục tới expiry; stale ADMIN có thể cross-owner.
- **Controls/counterevidence:** signature/expiry và owner check có; không phân biệt token type hay current account/role.
- **Validation/fix/tests/DoD:** dùng shared auth service cho HTTP/WS; không query token. Negative tests challenge/locked/version/role downgrade. DoD: parity matrix HTTP=WS pass.

### SEC-003 — Unenrolled admins receive full password-only sessions

- **Status/classification/confidence:** CONFIRMED; privileged MFA; P1/high; high.
- **Invariant:** admin chưa enroll/verify MFA chỉ có enrollment-scoped token, không access/refresh bình thường.
- **Actual/trigger:** `auth.service.ts:168-175` trả normal auth response/tokens (`:754-796`) với advisory `forceMfaSetup`; admin/user/AI/skill/readiness routes thiếu step-up (`admin.controller.ts:24-39`, `:61-118`; `skill-graph.controller.ts:101-141`; `readiness.controller.ts:52-69`).
- **Root cause/workflow/impact:** enforcement phân tán per-route. Compromised password đọc PII/AI ops và mutate scoring/taxonomy trước MFA.
- **Controls/counterevidence:** RolesGuard và selected MfaStepUpGuard tồn tại; chính inconsistency làm bypass.
- **Validation/fix/tests/DoD:** enrollment-only token + controller-level step-up với explicit setup exemption. Tests no-MFA/read-only/mutation/refresh. DoD: privileged route inventory có deny-by-default MFA evidence.

### SEC-012 — Visible logout does not revoke refresh-token family

- **Status/classification/confidence:** CONFIRMED; session security; P1/high; high.
- **Invariant:** logout làm token family không refresh được, đồng thời local cleanup luôn hoàn tất dù network fail.
- **Actual/trigger:** Navbar chỉ gọi local `logout()`/navigate (`apps/web/src/components/layout/Navbar.tsx:92-95`); store chỉ remove three entries (`auth.store.ts:81-85`). API revocation endpoint/service đã có (`auth.controller.ts:57-63`; `auth.service.ts:281-301`) nhưng web không gọi.
- **Root cause/workflow/impact:** không có centralized async logout coordinator. Refresh token đã copy vẫn mint access sau user-visible logout.
- **Controls/counterevidence:** token bị xóa khỏi browser hiện tại và server mechanism đúng; stolen copy ngoài browser không bị revoke.
- **Validation/fix/tests/DoD:** POST logout với refresh token trước/best-effort around local cleanup; test old token 401 và failure vẫn local-clean. DoD: một logout path duy nhất dùng trên mọi UI.

### PRIV-001 — Authenticated caches cross browser account boundaries

- **Status/classification/confidence:** CONFIRMED; privacy/cache isolation; P1/high; high.
- **Invariant:** account B/offline không nhận data của A; authenticated cache partition theo immutable user hoặc không cache; logout evict toàn bộ private state.
- **Actual/trigger:** Workbox cache shared 7 ngày cho authenticated flashcards (`apps/web/vite.config.ts:50-55`); stable user URLs/query keys (`useFlashcards.ts:21-51`; `ProfilePage.tsx:55`); singleton QueryClient fresh 5s (`App.tsx:40-48`); logout không clear CacheStorage/QueryClient.
- **Root cause/workflow/impact:** cache key không chứa identity và logout thiếu cache boundary. Shared browser account switch/offline có thể hiển thị A flashcards/profile/tenant data cho B.
- **Controls/counterevidence:** NetworkFirst và 7-day expiry giảm likelihood online; offline fallback và in-memory fresh window vẫn tồn tại.
- **Validation/fix/tests/DoD:** bỏ authenticated Workbox caching hoặc partition + purge; cancel/clear queries; user-scoped keys. E2E A→logout→B offline. DoD: zero A payload/draft/query/cache entry observable.

### FUNC-001 — Non-text mock providers persist fake authoritative production data

- **Status/classification/confidence:** CONFIRMED; correctness/provider authority; P1/high; high.
- **Invariant:** mock/fallback output không tạo authoritative FileAsset/score ở production; provider và authority state phải truy vết được.
- **Actual/trigger:** storage defaults mock (`storage.module.ts:26-35`), unknown key gets fabricated metadata (`mock-storage.provider.ts:38-47`), confirm persists asset (`storage.service.ts:53-86`). Vision defaults/falls back mock (`system-design.module.ts:29-52`), fixed 8.5 (`mock-vision.provider.ts:68-81`) được upsert score (`design-evaluation.service.ts:64-89`).
- **Root cause/workflow/impact:** production fail-closed policy chỉ áp dụng text-AI. Phantom files và synthetic scores indistinguishable from real.
- **Controls/counterevidence:** text-AI mock blocked/needsReview (`provider-router.service.ts:81-92`, `:246-254`); không bảo vệ storage/vision.
- **Validation/fix/tests/DoD:** common provider policy; prod bootstrap reject mock hoặc persist NON_AUTHORITATIVE; unknown object cannot confirm. DoD: no mock authoritative row, provider/authority exposed in API/audit.

### REL-001 — Authoritative async handoffs have no durable recovery

- **Status/classification/confidence:** CONFIRMED; reliability/data integrity; P1/high; high.
- **Invariant:** DB commit và downstream job intent phải atomic/durably repairable; retry terminal states phải repair missing artifact exactly once.
- **Actual/trigger A:** answer/session commit (`interview.service.ts:365-393`), queue add fail bị swallow (`:399-420`), không reconciler; session kẹt EVALUATING.
- **Actual/trigger B:** final evaluation sets COMPLETED (`evaluation.processor.ts:226-250`) trước learning-path enqueue (`:371-439`); retry terminal guard skip (`:85-91`), path mất vĩnh viễn.
- **Root cause/workflow/impact:** no outbox/reconciliation contract; core interview/learning roadmap incomplete dù API/job báo success/retry.
- **Controls/counterevidence:** answer/evaluation rows preserved; deterministic job IDs và normal retries giảm duplicates nhưng không repair pre-enqueue/terminal gap.
- **Validation/fix/tests/DoD:** transactional outbox hoặc idempotent reconciler cho cả intents, age/error metrics. Fault-injection tests fail exact queue call then recover once. DoD: no stuck state/missing path after transient Redis failure.

### OPS-001 — Production artifact/runtime contract cannot boot

- **Status/classification/confidence:** CONFIRMED; deploy/operations; P1/blocker; high.
- **Invariant:** same built image boots API/worker with valid secret-managed DB/Redis/provider config.
- **Actual/trigger:** runner copies `/app/apps/api/dist` (`apps/api/Dockerfile:35`) nhưng runs `/app/dist/main.js` (`:46`); Compose worker `/app/dist/worker.js` (`docker-compose.yml:80`); Terraform `/app/dist/src/worker.js` (`compute/main.tf:211`). ECS omits required JWT secrets (`env.validation.ts:12-15`; `compute.main.tf:176-218`), DB URL credentials/name mismatch (`:180`; `database/main.tf:50`), Redis auth/TLS unsupported (`redis/main.tf:34`; `redis.service.ts:18`). Compose production defaults AI mock nhưng router rejects (`docker-compose.yml:51-57`; `provider-router.service.ts:81-92`).
- **Root cause/workflow/impact:** no executable artifact/config contract or image smoke gate; restart loops/no readiness.
- **Controls/counterevidence:** non-root runner và CI workspace build exist; neither validates final image/task.
- **Validation/fix/tests/DoD:** normalize workdir/commands, ECS secrets, DB URL, Redis TLS/password, explicit prod providers. Build/start both roles; ready + consume job; rendered task contract. DoD: staging boots from same immutable digest.

### CI-001 — Critical release lanes are absent or cannot bootstrap

- **Status/classification/confidence:** CONFIRMED; CI/release control; P1/high; high.
- **Invariant:** CI must explicitly run API integration and browser E2E against bootable servers with production-only negative branches/image smoke.
- **Actual/trigger:** Playwright step env lacks required JWT secrets (`.github/workflows/ci.yml:99-106`; `env.validation.ts:12-15`), while config starts API (`apps/web/playwright.config.ts:24-29`). Default `pnpm test` step (`ci.yml:87-94`) does not explicitly run the single integration/E2E lane; CI never builds/starts Docker image (`:96-106`).
- **Root cause/workflow/impact:** source-build/unit lane mistaken for deploy contract; browser lane fails before assertions and DB/Redis integration remains unproven.
- **Controls/counterevidence:** format/lint/typecheck/migrate/unit/build/Playwright steps exist; packet recorded 424 pass. Current build/E2E run not observed.
- **Validation/fix/tests/DoD:** explicit integration script, correct isolated secrets, image smoke, artifacts/logs. DoD: current commit green with nonzero tests in both lanes and boot evidence.

## P2 — Material remediation

### SEC-004 — Behavioral STAR report BOLA

- **Status/classification/confidence:** CONFIRMED; authorization/privacy; P2/medium; high.
- **Invariant/actual:** owner/admin/explicit mentor only. Controller passes only `answerId` (`behavioral.controller.ts:50-54`); service returns `StarEvaluation` or reads `Answer.content` without owner join (`behavioral.service.ts:72-135`).
- **Trigger/impact:** authenticated caller knows another answer UUID; receives STAR excerpts/scores/feedback.
- **Root/control/counterevidence:** missing service predicate; JWT and UUID entropy only.
- **Fix/tests/DoD:** query through answer→turn→session with current user/role; owner success, non-owner 403/404, explicit privileged relationship tests. DoD: both persisted and fallback paths share predicate.

### SEC-005 — Unregistered storage keys bypass ownership

- **Status/classification/confidence:** CONFIRMED; object authorization; P2/medium; high.
- **Invariant/actual:** caller-bound upload intent required. Intent only returns key (`storage.service.ts:28-50`), confirm claims any existing object (`:53-86`), download/delete sign/delete if FileAsset absent (`:113-152`; `s3-storage.provider.ts:65-84`).
- **Trigger/impact:** authenticated caller learns orphan/unconfirmed key; can read/delete/claim/publish object.
- **Controls/counterevidence:** registered asset owner check; userId+UUID keys make discovery hard, not authorization.
- **Fix/tests/DoD:** persist expiring single-use intent; reject unregistered keys; canonical prefix. Cross-user/orphan/expired/replay tests. DoD: no provider call before authorization.

### SEC-006 — Mentor override authority is not bound to target interview

- **Status/classification/confidence:** CONFIRMED; privileged object authorization; P2/medium; high.
- **Invariant/actual:** exact engagement/evaluation + bounded window. Service accepts any scheduled/in-progress/**completed** mentor-candidate session (`live-session.service.ts:156-205`), then rewrites authoritative score (`:207-277`); controller takes evaluation ID (`live-session.controller.ts:47-61`).
- **Trigger/impact:** former mentor + target UUID alters unrelated/future interview, affecting readiness/certificates.
- **Controls/counterevidence:** MentorProfile, relationship, UUID, score/justification checks; none bind target.
- **Fix/tests/DoD:** schema/service relation to exact interview/evaluation; expiry/review grant; negative unrelated/completed tests. DoD: auditable scoped authorization.

### SEC-007 — Unbounded Judge0 test-case fanout

- **Status/classification/confidence:** CONFIRMED; resource/cost abuse; P2/medium; high.
- **Invariant/actual:** one request has server-bounded executions/input/output. DTO only `IsArray` (`code-execution.dto.ts:14-34`); provider loops one remote call per element (`judge0.provider.ts:80-167`) after ownership (`code-execution.service.ts:50-81`).
- **Trigger/impact:** authenticated owner submits large array; N paid calls, long API occupancy/quota exhaustion.
- **Controls/counterevidence:** global throttle, source cap, per-execution CPU/memory/10s; no N bound.
- **Fix/tests/DoD:** `ArrayMaxSize`, nested/length validation, per-user execution quota/concurrency. Test provider call count zero on reject and capped on accept.

### SEC-008 — Share token and passcode are logged in plaintext URL

- **Status/classification/confidence:** CONFIRMED; secret logging/privacy; P2/medium; high.
- **Invariant/actual:** capability/passcode never enter URLs/logs. GET uses path token/query passcode (`public-share.controller.ts:13-18`); global logger logs `originalUrl` success/error (`logging.interceptor.ts:48-51`, `:74-96`; `app.module.ts:82-85`).
- **Trigger/impact:** valid access attempt + log reader obtains both factors and candidate report.
- **Controls/counterevidence:** random token/bcrypt DB hash; irrelevant to runtime URL log.
- **Fix/tests/DoD:** POST/exchange grant, route-template/redaction across success/error/proxy/APM. Tests assert no secret in captured logs.

### REL-002 — Interview SSE auth and fan-out contract is invalid

- **Status/classification/confidence:** CONFIRMED; realtime reliability; P2/medium; high.
- **Invariant/actual:** authenticated event reaches client across replicas; fallback detects silence. Native EventSource sends no bearer (`use-interview-sse.ts:47-52`), while API extracts only header (`jwt.strategy.ts:15-17`). Server uses process-local Subject (`sse.service.ts:13-30`); worker emits there (`evaluation.processor.ts:306`) but API serves connection (`interview.controller.ts:134-143`).
- **Trigger/impact:** normal localStorage auth yields 401 then 3s polling; if auth fixed, worker/replica event still invisible.
- **Controls/counterevidence:** authorized polling fallback (`use-interview-sse.ts:75-89`) preserves eventual state, reducing priority.
- **Fix/tests/DoD:** fetch-streaming bearer or secure cookie + Redis Pub/Sub/Streams, or explicitly polling-only. Multi-process browser test with polling disabled proves event delivery.

### REL-003 — API/worker share processors and every replica runs cron

- **Status/classification/confidence:** CONFIRMED; process isolation/scheduling/performance; P2/medium; high.
- **Invariant/actual:** API serves HTTP only; worker consumes queues; one idempotent scheduler. Both bootstrap `AppModule` (`main.ts:12`; `worker.ts:9`), modules register processors/cron (`app.module.ts:54-75`; `notification.module.ts:8-10`). Reminder full-query/send loop has no lock/dedupe (`streak-reminder.cron.ts:18-48`).
- **Trigger/impact:** 2 API+2 worker (`compute.main.tf:237`, `:262`) => four cron executions/duplicate pushes; API competes for jobs/latency; unbounded serial fanout.
- **Controls/counterevidence:** BullMQ distributes each queue job once, so processor duplication alone is not duplicate execution.
- **Fix/tests/DoD:** separate module graphs; unique scheduled Bull job/distributed lease + per-user/day idempotency; pagination/bounded concurrency. Four-process test sends one reminder.

### PRIV-002 — Retention, export and deletion claims are not enforced

- **Status/classification/confidence:** CONFIRMED; privacy/compliance gap (không khẳng định legal violation); P2/medium; high.
- **Invariant/actual:** documented TTL/delete/export must have executable complete controls. Voice doc promises 30d purge (`docs/features/F001-VOICE-REALTIME-INTERVIEW.md:209-214`) nhưng schema không expiry (`schema.prisma:1060-1091`). CV only sets timestamp (`document-parser.service.ts:46-60`) và reads expired (`:197-221`). Profile controller chỉ export, không delete (`profile.controller.ts:15-39`); export loads subset (`profile.service.ts:314-340`) so “complete GDPR” claim không phủ user relations (`schema.prisma:74-103`).
- **Trigger/impact:** time > TTL/user request; personal data persists, deletion unavailable, export incomplete.
- **Controls/counterevidence:** PII scrub, manual document delete, DB cascades và partial export có; không thực thi promised lifecycle.
- **Fix/tests/DoD:** versioned data inventory, retention worker DB+object store, audited erasure with exceptions, complete export manifest. Seed/age/delete/export integration tests. Owner phải xác nhận policy trước migration.

### OPS-002 — Traffic health and worker observability do not represent runtime health

- **Status/classification/confidence:** CONFIRMED; operations/observability; P2/medium; med-high.
- **Invariant/actual:** traffic admission uses dependency readiness; worker metrics are scrapeable/alerted. Ready checks DB+Redis (`health.controller.ts:31-53`) nhưng ALB/Docker use live (`compute.main.tf:130-140`; `Dockerfile:43-44`). Each process registry local (`metrics.service.ts:31-39`); worker application context no metrics HTTP endpoint (`worker.ts:9-13`; `metrics.controller.ts:8-20`). Alert rules exist (`infra/prometheus/alert_rules.yml:48-67`) nhưng repo không chứng minh scrape/rule/Alertmanager wiring.
- **Trigger/impact:** DB/Redis down vẫn receive traffic; exclusive worker lag/failure invisible.
- **Controls/counterevidence:** live/ready endpoints và matching metric names/rules là strengths; production external monitoring remains unknown.
- **Fix/tests/DoD:** ALB readiness with timeouts; worker metrics endpoint/aggregation; checked scrape/alert delivery. Dependency-failure and worker-only job tests.

### A11Y-001 — Critical dialogs and whiteboard are not keyboard/focus complete

- **Status/classification/confidence:** CONFIRMED; accessibility/UX; P2/medium; high static, runtime not tested.
- **Invariant/actual:** critical control keyboard-operable; modal labelled, focus on open/trapped/restored. Whiteboard elements are clickable `div` only (`WhiteboardRoom.tsx:277-291`). Share/payment/mentor overlays are plain containers (`ShareSessionModal.tsx:71`; `VietQrCheckoutModal.tsx:52`; `ScoreOverrideModal.tsx:61`). Shared Modal has role/Escape but no focus lifecycle/title association (`Modal.tsx:24-75`).
- **Trigger/impact:** keyboard/screen-reader user cannot reliably select design elements or remain oriented in share/payment/score override.
- **Controls/counterevidence:** Escape, dialog role, skip link và ARIA on several controls; not full focus/keyboard behavior.
- **Fix/tests/DoD:** one accessible dialog primitive; semantic buttons/keyboard handlers. RTL/axe + browser Tab/Shift+Tab/Escape/restore and keyboard-only whiteboard flow.

## P3/P4 backlog

| ID       | Status       | Observation                                                 | Evidence / disposition                                                                                         |
| -------- | ------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| SEC-009  | CONFIRMED P3 | protected share feedback does not require passcode/grant    | `public-share.controller.ts:21-25`; `share.service.ts:428-477`; token still required, no direct score mutation |
| SEC-010  | CONFIRMED P3 | PayOS return/cancel URLs lack Stripe-style origin validator | `billing.controller.ts:44-54`; `billing.service.ts:358-370`; authenticated/provider-mediated                   |
| SEC-011  | CONFIRMED P3 | source-known default VAPID private key                      | `push-notification.service.ts:15-26`; subscription tuple remains additional prerequisite                       |
| FUNC-002 | CONFIRMED P3 | audio fallback always includes canned mock transcript       | `audio-orchestrator.service.ts:52-73`; user must review/edit before submit (`AudioAnswerRecorder.tsx:300-344`) |
| HARD-001 | PARTIAL P3   | GitHub Actions not SHA-pinned; SBOM absent                  | `.github/workflows/ci.yml:41-60`; hardening/release provenance, not vulnerability                              |

## VERIFIED_FIXED / rejected / deferred

| Candidate                                             | Disposition                 | Current evidence                                                                                         |
| ----------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------- |
| Stripe missing-key production checkout                | VERIFIED_FIXED              | fail-closed before mock authority (`billing.service.ts:37-47`)                                           |
| Text-AI production mock fallback                      | VERIFIED_FIXED              | mock filtered; empty chain throws (`provider-router.service.ts:81-123`)                                  |
| Personalized learning-path shared cache               | VERIFIED_FIXED              | no cache get/set on path (`provider-router.service.ts:366-384`)                                          |
| “AI cost alert metric name mismatch”                  | REJECTED                    | collector is exactly `ai_estimated_cost_usd_total` (`metrics.service.ts:97`)                             |
| localStorage alone                                    | REJECTED as standalone vuln | only SEC-012/PRIV-001 concrete boundaries reported                                                       |
| public metrics leaks direct PII                       | REJECTED                    | reviewed labels aggregate method/route/queue/provider/model, no user/email (`metrics.service.ts:45-128`) |
| command injection/SSRF/path traversal/deserialization | REJECTED                    | no validated attacker-controlled sink in scoped Standard scan                                            |
| production external controls                          | DEFERRED/UNKNOWN            | ingress, secrets, backups, object lifecycle, log ACL, provider contracts require owner/staging evidence  |
