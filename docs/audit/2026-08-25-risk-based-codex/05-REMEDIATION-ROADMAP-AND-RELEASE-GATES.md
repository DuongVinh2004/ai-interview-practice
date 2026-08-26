# 05 — Remediation Roadmap and Release Gates

## Remediation waves

### Wave 0 — Freeze release authority

Tạm disable PayOS production path nếu không thể chứng minh credentials/signature enforcement (SEC-001); không promote image hiện tại (OPS-001); không coi system-design/storage mock artifacts là authoritative (FUNC-001). Không cần destructive migration.

### Wave 1 — Identity, payment và object authorization

SEC-001, SEC-002, SEC-003, SEC-004, SEC-006, SEC-012, PRIV-001, SEC-008. Dependency: shared auth policy cho HTTP/WebSocket; logout coordinator owns API revocation + cache eviction; payment webhook owns signature/state/idempotency. Sau wave chạy negative auth/payment/account-switch tests trước mọi feature work.

### Wave 2 — Runnable deployment và executable gates

OPS-001, CI-001, OPS-002. Chuẩn hóa image workdir/commands, ECS secrets/DB/Redis config, production provider requirements; build/start API+worker images; dùng readiness cho traffic; expose/scrape worker metrics; bật integration và Playwright với env đúng.

### Wave 3 — Durable authority and process topology

REL-001, REL-002, REL-003, FUNC-001. Dùng outbox/reconciler cho answer/evaluation/learning-path; distributed event fan-out hoặc always-on polling contract; tách API/worker/cron modules; fail closed non-text mocks.

### Wave 4 — Privacy, bounded cost và accessibility

PRIV-002, SEC-005, SEC-007, A11Y-001. Thực thi TTL/purge/export/delete manifest; upload intent ownership; Judge0 batch bounds; accessible dialog/focus/whiteboard keyboard behavior.

### Wave 5 — P3 backlog

SEC-009 passcode feedback, SEC-010 PayOS redirect, SEC-011 VAPID key, FUNC-002 editable audio mock UX, HARD-001 SHA pin/SBOM. Không gọi chúng là vulnerability/release blocker nếu preconditions không thay đổi.

## Release gates

| Gate                           | Current | Close condition / required evidence                                                                                          |
| ------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| G1 Payment authority           | FAIL    | PayOS production missing config disabled/fails; unsigned/wrong amount/replay tests; valid callback exactly once              |
| G2 Auth/MFA/session            | FAIL    | shared HTTP/WS token validation; unenrolled admin limited token; logout invalidates refresh; A→B cache isolation             |
| G3 Object/mentor authorization | FAIL    | non-owner STAR/storage/override negative tests in real DB integration lane                                                   |
| G4 Authoritative async state   | FAIL    | queue-failure recovery for answer and final learning path; no permanent stuck state; repair metrics                          |
| G5 Provider authority          | FAIL    | production mock storage/vision rejected or explicitly non-authoritative; provider/authority persisted                        |
| G6 Runnable artifacts          | FAIL    | Docker API+worker image build/start; health ready; one job consumed; rendered ECS task has valid secrets/DB/Redis TLS        |
| G7 CI evidence                 | FAIL    | API integration explicitly runs; Playwright server boots with required env; current build passes; artifacts/logs retained    |
| G8 Reliability/observability   | FAIL    | API no processors; single cron execution; distributed/polling event contract; ALB readiness; worker metrics + alert delivery |
| G9 Privacy lifecycle           | FAIL    | aged CV/voice/object purge; complete export manifest; authenticated deletion workflow with retention exceptions              |
| G10 Accessibility              | FAIL    | keyboard-only critical flows; modal focus trap/restore/title; targeted axe/browser evidence                                  |
| G11 Dirty-tree integrity       | OPEN    | implementation branches preserve all 107 baseline entries or owner provides explicit merge/rebase plan                       |

## Quy tắc quyết định

- **GO:** mọi P1/P2 gate đóng, full release lanes pass trên candidate artifact, không unknown production control trọng yếu.
- **CONDITIONAL GO:** mọi P1 đóng; P2 còn lại có bounded blast radius, owner/risk acceptance, monitoring và rollback được chứng minh.
- **NO-GO (hiện tại):** bất kỳ P1 mở, image không runnable, payment/auth authority fail-open, hoặc integration/browser evidence không khả dụng.
- **INSUFFICIENT EVIDENCE:** chỉ dùng khi không thể disposition; audit này đã disposition high-risk candidates nên chọn NO-GO.

Owner decisions còn thiếu: production PayOS có được phép disable; voice/system-design/storage feature nào release-authoritative; cookie vs fetch-streaming cho SSE; authoritative retention periods/exceptions; mentor override window; target IaC/runtime thực sự là ECS Terraform hay deployment khác.
