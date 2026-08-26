# 02 — Audit by Workstream

## A — Correctness, Backend and Data

**Strengths:** ownership/state checks phổ biến; answer persistence và CAS cùng transaction (`interview.service.ts:365-393`); deterministic job IDs/retries (`:400-414`); Stripe/text-AI/learning-cache Wave 1 đã sửa; PayOS reconciliation dùng durable invoice (`billing.service.ts:424`).

**Findings:** SEC-001, SEC-004, SEC-006, FUNC-001, REL-001. PayOS authority fail-open; behavioral report thiếu owner; mentor override scope quá rộng; storage/vision mock trở thành authoritative; hai async handoff không có recovery.

**Rejected/limited:** answer row không bị mất khi enqueue fail; metric alert names khớp collectors; blueprint ownership AND condition không exploitable trong schema path bình thường vì cả hai required relations được tạo sau dual ownership checks (`document-parser.service.ts:127-149`).

## B — Architecture, Reliability and Performance

**Strengths:** BullMQ retry/backoff/terminal guards; health live/ready tách biệt; provider circuit breakers/timeouts; per-execution Judge0 CPU/memory/timeouts (`judge0.provider.ts:80`).

**Findings:** REL-001, REL-002, REL-003, SEC-007, OPS-002. `AppModule` dùng cho cả API/worker; cron chạy trên mọi replica; SSE auth/fan-out contract sai; one request có N Judge0 calls; worker metrics không scrape và ALB dùng liveness.

**Scale trigger:** reminder query `findMany` toàn bộ rồi send tuần tự (`streak-reminder.cron.ts:27-48`); report là phần của REL-003 vì cùng process/scheduling root cause. Không report generic N+1 nếu không có plausible release effect.

## C — Security and Privacy

Standard scan `c7baf331-6938-498d-9d82-05a647f57395`, scope `apps/api/src`, hoàn tất với 11 findings: 3 high, 5 medium, 3 low. Xem [Security Scan Index](security/SECURITY-SCAN-INDEX.md).

Parent targeted review bổ sung SEC-012 (logout server revocation), PRIV-001 (cross-account authenticated caches) và PRIV-002 (retention/export/delete). LocalStorage tự thân không được coi là vulnerability; impact được trace qua missing revocation/cache isolation. Missing SBOM/SHA pin chỉ là HARD-001 P3.

**Verified fixed:** Stripe production fail-closed (`billing.service.ts:37`), text-AI mock exclusion (`provider-router.service.ts:81`) và learning-path shared-cache removal (`provider-router.service.ts:384`).

## D — Frontend, UX and Accessibility

**Strengths:** shared Modal có `role=dialog`, Escape và body scroll lock (`apps/web/src/components/ui/Modal.tsx:24-54`); app có skip link/live regions; audio transcript được user review/edit trước submit (`AudioAnswerRecorder.tsx:300-344`); polling fallback tồn tại (`use-interview-sse.ts:75-89`).

**Findings:** SEC-012, PRIV-001, REL-002, A11Y-001. Native EventSource không gửi bearer; whiteboard clickable `div` không keyboard-operable (`WhiteboardRoom.tsx:277`); critical overlays/shared Modal thiếu full focus lifecycle/title association (`Modal.tsx:50`).

**Limitation:** không render browser/pixel review, không test responsive, focus order, screen-reader announcement hay offline behavior thực tế. A11Y finding dựa trên DOM source, không tuyên bố WCAG conformance audit đầy đủ.

## E — Tests, CI, Deployment and Documentation

**Strengths:** CI có format/lint/typecheck/migration/unit/build/Playwright steps (`.github/workflows/ci.yml:70-106`); security workflow có secret/SAST/SCA/container scanning; evidence packet ghi 118 suites/424 tests pass.

**Findings:** OPS-001, CI-001, OPS-002, PRIV-002. Runner copy/command paths lệch (`Dockerfile:35-46`); ECS thiếu JWT secrets, DB credentials và Redis TLS/auth (`compute/main.tf:176-218`); Playwright step thiếu required JWT env; API integration không được gọi; retention/deletion/export claims vượt implementation.

**Unknowns:** current build, image build/start, `terraform validate/plan`, API integration, Playwright, staging smoke, alert delivery. Build step tồn tại trong CI nhưng audit không quan sát run của current dirty tree.

## Coverage statement

Tier 1 hoàn tất theo risk surfaces; Tier 2 targeted; Tier 3 sampled/inventory. Hai general auditors và một independent security baseline đều read-only; parent cross-validated material candidates. Không có Git history, web browse, Deep Scan, exhaustive test-file reading, benchmark hay full lint-warning analysis.
