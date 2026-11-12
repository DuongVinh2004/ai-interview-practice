# Trạng thái Dự án — AI Interview Practice

> **Cập nhật lần cuối**: 2026-10-26  
> **Repo**: [DuongVinh2004/ai-interview-practice](https://github.com/DuongVinh2004/ai-interview-practice)

Tài liệu này là **single source of truth** cho trạng thái triển khai dự án. Tất cả tính năng dưới đây đã có **code thật + automated tests verified** trong monorepo.

---

## 🛡️ BẢN VÁ BẢO MẬT & HARDENING (Ultra-Strict Audit Remediation)

- [x] **BLOCKER-001 (MFA Challenge Token Separation & Strategy Hardening)**: Dùng `tokenType: 'mfa_challenge'` riêng biệt, từ chối toàn bộ request mang token MFA pending vào các protected API endpoints.
- [x] **BLOCKER-002 (Multi-Tenant Session Isolation & Cohort Analytics)**: Bổ sung liên kết `tenantId` & `assignmentId` trong schema `InterviewSession`. Viết lại query cohort analytics để chỉ lọc session thuộc về tenant đó. Loại bỏ hoàn toàn công thức giả lập `Math.sin`.
- [x] **BLOCKER-003 (Predictable Secrets Purged)**: Gỡ bỏ toàn bộ fallback secret mặc định trong `docker-compose.yml`, bắt buộc nạp secret an toàn qua environment.
- [x] **CRITICAL-001 (Stripe Webhook Fail-Closed & Raw Body Verification)**: Bật `rawBody: true` trong NestJS bootstrap, xác thực chữ ký HMAC-SHA256 trên raw buffer bytes, fail-closed khi thiếu `STRIPE_WEBHOOK_SECRET`.
- [x] **HIGH-001 (Atomic Refresh Token Rotation)**: Áp dụng conditional update `WHERE id = ? AND is_revoked = false` để loại trừ race condition và thu hồi toàn bộ token family khi phát hiện token reuse.
- [x] **HIGH-002 (Serializable Quota Enforcement)**: Áp dụng `Serializable` transaction isolation level cho `checkAndConsumeQuota()` nhằm ngăn ngừa TOCTOU race conditions.
- [x] **HIGH-003 (Atomic Request-Bound Idempotency)**: Hash payload SHA-256, đặt trạng thái reservation `IN_PROGRESS` ngăn chặn concurrent execution và phát hiện body conflicts.
- [x] **HIGH-004 (Queue Dual-Write Resilience)**: Xử lý lỗi enqueue BullMQ thất bại một cách an toàn, cập nhật trạng thái session FAILED và trả lỗi rõ ràng.
- [x] **HIGH-005 (CAS State Machine Invariants)**: Áp dụng Compare-And-Swap (`updateMany WHERE state NOT IN ('CANCELLED', 'COMPLETED')`) trong các worker processors để không hồi sinh session đã hủy.
- [x] **HIGH-006 (Dynamic Total Turns Configuration)**: Hỗ trợ dynamic `totalTurns` (1–5) xuyên suốt lifecycle và evaluation processor thay vì hardcode 5 lượt.
- [x] **HIGH-007 (Durable AI Daily Budget)**: Tính toán chi phí AI hàng ngày dựa trên tổng hợp thực tế từ database `aiRuns`.
- [x] **HIGH-008 (Voice Gateway Pre-Auth Hardening)**: Từ chối và đóng socket khi nhận frame nhị phân trước khi xác thực, giới hạn dung lượng buffer 5MB/lượt.
- [x] **HIGH-009 (CV Extraction Integrity)**: Loại bỏ hoàn toàn việc bịa đặt dữ liệu kinh nghiệm làm việc khi CV không có thông tin.
- [x] **HIGH-010 (Production Stripe Fail-Closed)**: Ném lỗi `503` khi thiếu Stripe API key ở môi trường production, chỉ cho phép mock session ở môi trường dev/test.
- [x] **HIGH-011 (Blueprint Ownership Validation)**: Xác thực quyền sở hữu `userId` khi liên kết blueprint vào session.
- [x] **HIGH-012 & LOW-002 (Judge0 Hard Timeout & Language Validation)**: Thêm `AbortSignal.timeout(10000)`, kiểm tra `response.ok`, từ chối ngôn ngữ không hỗ trợ với lỗi validation rõ ràng.
- [x] **MEDIUM-001 (CI Critical Security Gate)**: Cấu hình Trivy SCA scanner với `exit-code: 1` khi phát hiện lỗ hổng CRITICAL.
- [x] **MEDIUM-003 (Token Version Invalidation)**: Tăng `tokenVersion` khi đổi mật khẩu để thu hồi tức thì toàn bộ JWT access token hiện hành.
- [x] **MEDIUM-004 (Explicit Tenant Context)**: Bắt buộc header `x-tenant-id` hoặc URL param, loại bỏ cơ chế tự động chọn tenant gây nhầm lẫn.
- [x] **MEDIUM-010 (AES-256-GCM MFA Secret Encryption)**: Mã hóa TOTP secret key ở trạng thái nghỉ (at-rest) trước khi lưu vào cơ sở dữ liệu.

---

## ✅ ĐÃ HOÀN THÀNH — MVP (Milestones M0 → M5)

### Codebase Foundation

- [x] Monorepo pnpm workspaces (`apps/api`, `apps/web`, `packages/*`)
- [x] NestJS 11 Modular Monolith — 16 modules: `auth`, `profile`, `taxonomy`, `interview`, `ai-orchestrator`, `audio-orchestrator`, `evaluation`, `learning-path`, `history-report`, `share`, `analytics`, `admin`, `code-execution`, `billing`, `document-parser`, `platform`
- [x] React 18 + Vite + TypeScript + Tailwind CSS + TanStack Query + Zustand
- [x] PostgreSQL 16 + Prisma 6 ORM (idempotent seed)
- [x] Redis 7 + BullMQ (3 queues: question-generation, answer-evaluation, learning-path)
- [x] Shared contracts package (`@ai-interview/contracts`) — Zod schemas, enums, types
- [x] Docker Compose multi-container environment
- [x] Nginx reverse proxy (SSE buffering off)

### Identity & Access (Epics E02, E03)

- [x] Email/password registration & login (bcrypt, no account enumeration)
- [x] JWT access token (15 min) + refresh token rotation (7 days)
- [x] Token replay detection → revoke entire session family + audit log
- [x] TOTP MFA setup/enable/verify/disable (RFC 6238, ±1 step window)
- [x] 8 single-use bcrypt-hashed recovery codes (atomic consumption)
- [x] MFA Step-Up Guard for sensitive admin operations
- [x] RBAC: `CANDIDATE`, `ADMIN` roles
- [x] Password change with token invalidation
- [x] Password reset flow (Forgot password, SHA-256 single-use tokens, 1h expiry, tokenVersion revocation)
- [x] Email verification flow (Verification token, 24h expiry, resend endpoint, `is_email_verified` tracking)
- [x] Frontend Auth pages: `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyEmailPage`
- [x] React Email templates: `PasswordResetEmail` and `EmailVerificationEmail` (Bilingual VI/EN)

### Interview Core (Epic E04)

- [x] Session state machine: `CREATED → ACTIVE → EVALUATING → COMPLETED/CANCELLED/FAILED`
- [x] 3 session modes: `STANDARD` (1-5 turns), `FOCUSED_REMEDIATION`, `QUICK_PRACTICE`
- [x] Adaptive difficulty: score ≥ 7.5 → step up, ≤ 4.0 → step down
- [x] Answer persistence before BullMQ enqueue (ADR 0004)
- [x] `Idempotency-Key` HTTP header support with atomic reservation
- [x] SSE real-time events + REST polling fallback (`/interviews/:id/status`)
- [x] Sandbox mode (sessions don't affect progress)

### AI & Evaluation (Epics E06, E07, E08)

- [x] Provider abstraction interface (`AiProvider`)
- [x] 4 providers: `MockAiProvider` (deterministic), `GeminiProvider`, `OpenAiProvider`, `AnthropicProvider`
- [x] Provider Router with circuit breakers (5 failures → 30s trip) + durable daily cost budget
- [x] Prompt Registry & version management
- [x] AI Security Filter — pre-filter (injection detection) + post-filter (evidence verification, range check)
- [x] Zod schema validation on all AI outputs
- [x] Rubric scoring: Technical Accuracy, Depth, Clarity (weighted: 0.4/0.3/0.3)
- [x] Evidence extraction from candidate answers
- [x] Confidence rating (0.0–1.0)
- [x] Golden dataset v2 (12 benchmark cases) + adversarial eval suite
- [x] Re-evaluation with immutable audit trail

### Results & Learning (Epic E09)

- [x] Score breakdown with rubric dimensions
- [x] Strengths & improvements lists with evidence
- [x] Learning path generation (gaps, priorities, search keywords)
- [x] Learning path item completion tracking
- [x] Cross-session goals aggregation (`/learning-path/my-goals`)
- [x] History with pagination, filters (role, technology, competency, date, score range)
- [x] Competency radar chart (5-axis SVG)
- [x] Progress trend tracking

### Share & Mentor Review

- [x] Share tokens (time-limited: 1d/7d/30d/never, passcode protection, anonymization)
- [x] Mentor feedback comments (overall or per-turn)
- [x] Public shared result page (`/share/:token`)
- [x] Share revocation

### Audio (Basic — Phase 1)

- [x] Audio upload & transcription (Whisper STT — webm, wav, mp3, m4a, ogg ≤ 25MB)
- [x] Text-to-speech synthesis (OpenAI TTS — 6 voices)
- [x] Audio visualizer component
- [x] Voice mode controls in interview room

### Administration (Epic E05)

- [x] User search, lock/unlock (MFA step-up required)
- [x] AI runs telemetry & metrics dashboard
- [x] Prompt version management & activation
- [x] AI evaluation harness runner (golden dataset)

### Platform & Operations (Epics E13, E14, E15)

- [x] CI/CD pipeline (GitHub Actions: lint, typecheck, test, build)
- [x] Security scanning workflow
- [x] Prometheus metrics exporter (RED & USE metrics)
- [x] OpenTelemetry distributed tracing (W3C TraceContext)
- [x] Grafana dashboards (4: system overview, AI reliability, SLO error budget, BullMQ queues)
- [x] SLO alerting rules (Prometheus Alertmanager)
- [x] PITR backup + restore drill scripts
- [x] Redis backup scripts
- [x] Chaos game day simulator
- [x] Terraform IaC (modular: compute, database, network, redis, secrets, storage)
- [x] Terraform drift check script
- [x] Smoke test suite
- [x] ADRs 0001–0008

---

## 🚀 ĐÃ HOÀN THÀNH — Phase 2 Features (Waves 1 → 4)

### Wave 1

- [x] **F013 — Semantic Caching & LLM Fallback Router**: SHA-256 + embedding vector similarity caching, cache hits metrics, admin invalidation endpoints, zero-cost fallback, ADR 0005.
- [x] **F002 — Interactive Live Coding & Execution Sandbox**: Monaco editor, Mock & Judge0 execution providers (fail-closed + genuine testcase evaluation), AST Big-O complexity reviewer, split-pane IDE.
- [x] **F007 — Behavioral Interview & STAR Method Assessment**: 5-axis STAR scoring rubric, real-time proactive probing generator, `StarGuidePanel`, `StarRadarChart`, `StarAnnotationView`.
- [x] **F014 — Subscription & Usage-Based Billing**: Multi-tier plans (Free, Pro, Team, Enterprise), Mock & Stripe checkout (line items configured) & portal sessions, HMAC signature verification, atomic quota enforcement, `PricingPage`, `BillingDashboardPage`, ADR 0006.

### Wave 2

- [x] **F004 — JD & Resume Parsing for Tailored Interview**: In-memory PDF/DOCX magic-byte text extraction, PII regex scrubber, entity extraction & gap analysis, weighted blueprint generator (IDOR-protected), ADR 0007.
- [x] **F006 — Socratic AI Tutor & Instant Question Retry**: Socratic dialogue system prompt, SSE stream chat (max 20 turns), instant retry rubric score comparison with improvement badge, tutor rating.
- [x] **F005 — Spaced Repetition Drills & Smart Flashcards**: Pure TypeScript FSRS v4 algorithm engine (Difficulty, Stability, Retrievability), 3D flip card, review queue with keyboard shortcuts (Space, 1-4), streak heatmap calendar, auto-generation from interview weaknesses.
- [x] **F001 — Full-Duplex Live Voice Streaming Interview**: Low-latency WebSocket voice gateway with JWT authentication & interview ownership enforcement, energy-based VAD & barge-in interrupt detection, real-time audio visualizer & live transcript rolling feed, ADR 0008.

### Wave 3 & Wave 4

- [x] **F008 — Skill Graph & Benchmark**: Graph-based prerequisite dependency traverser, competency gap matrix, target role readiness mapper (`SkillGraphModule`).
- [x] **F009 — Readiness Score & Predictor**: Weighted multi-dimension readiness predictor, confidence index calculation, target role pass probability (`ReadinessModule`).
- [x] **F010 — Portfolio & Certificate**: Cryptographically verifiable public certificate verification (`/verify/cert/:id`), printable portfolio report, achievement badge system (`PortfolioModule`).
- [x] **F003 — System Design Whiteboard**: Interactive node/edge whiteboard editor, latency/throughput architecture evaluator, auto-assessment rubric (`SystemDesignModule`).
- [x] **F012 — Mentor Co-Pilot**: Real-time interviewer assist feed, suggested follow-up probing generator, candidate response rubric overlay (`MentorModule`).
- [x] **F011 — B2B Multi-Tenant Platform**: Tenant workspace isolation, domain routing, tenant role guard (`TENANT_ADMIN`, `INTERVIEWER`), hashed API key authentication, assignment management (`B2bModule`).
- [x] **F015 — Curated Question Bank & 5-Stage Governance**: Content curation, reviewer author check, safe projection, ledger quota consumption (`QuestionBankModule`).
- [x] **F016 — Saved Interview Configurations**: Blueprint templates, configuration serialization, quick-start session launcher (`InterviewConfigurationModule`).
- [x] **F017 — Engineering Arena & Forensic Anti-Cheat**: Multi-file sandbox workspaces, AST diff analysis, deterministic local/docker runtime, automated benchmark validation (`EngineeringArenaModule`).

---

## ⚡ ĐÃ HOÀN THÀNH — Plan B Production Integrations

### Sprint B1 & B2

- [x] **Module B1 — Cloud Object Storage (AWS S3 & Cloudflare R2)**: Presigned URL upload/download, bucket segregation (`public`, `documents`, `temp`), quota checks, direct-to-cloud browser upload hook (`useCloudUpload`), `StorageModule`.
- [x] **Module B2 — Transactional Email & Account Recovery System**:
  - Resend API provider & deterministic Mock provider with fail-closed production safety.
  - Asynchronous BullMQ worker queue (`email`) with exponential backoff retries.
  - React Email templates (VI & EN): `WelcomeEmail`, `InterviewCompletionEmail`, `StreakWarningEmail`, `PaymentReceiptEmail`, `PasswordResetEmail`, `EmailVerificationEmail`.
  - Secure anti-enumeration account recovery: SHA-256 token hashing, 60-minute expiry, `tokenVersion` increment invalidating all active JWTs.
  - Endpoints: `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/verify-email`, `POST /auth/resend-verification`.
  - Web UI: `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `VerifyEmailPage.tsx` with full i18n & automated test suite.

### Sprint B3 — Voice Pipeline (Deepgram STT & ElevenLabs TTS)

- [x] **Module B3 — Production Voice Streaming Infrastructure**:
  - `DeepgramSttProvider`: WebSocket real-time audio chunk streaming, fallback resilience.
  - `ElevenLabsTtsProvider`: Natural low-latency voice synthesis, chunked sentence audio playback with `SentenceChunkerService`.
  - Fail-closed audio routing, silence detection, token rate limiting.

### Sprint B4 — Payment Gateway (PayOS VietQR & Stripe Webhook)

- [x] **Module B4 — Multi-Provider Payment Gateway**:
  - PayOS VietQR payment flow with real-time QR code generation and checkout verification (`VietQrCheckoutModal.tsx`).
  - Stripe webhook raw body signature validation (`STRIPE_WEBHOOK_SECRET`), atomic event processing, idempotent subscription state synchronization.

### Sprint B5 — Vision AI (Multimodal System Design Architecture)

- [x] **Module B5 — Multimodal Vision Analysis**:
  - Dual Vision providers: OpenAI GPT-4o Vision & Google Gemini 2.0 Flash Vision for whiteboard diagram inspection.
  - Fail-closed architecture diagram analysis, invariant validation, component relationship evaluation.

---

## 🎮 KẾ HOẠCH PLAN C — Gamification, Engagement & PWA (Partial Complete)

### Đã hoàn thành (Completed)

- [x] **C1 — Gamification Engine**:
  - Level progression, XP points system, Achievement Badges, and Streak tracking engine (`gamification.store.ts`, `XpBar.tsx`, `XpPopup.tsx`, `LevelUpModal.tsx`, `BadgeUnlockToast.tsx`).
  - Database schema & API integration with daily bonus logic.
- [x] **C2 — SFX Engine**:
  - Zero-latency Web Audio API synthesizer fallback + Howler.js audio sprite system (`sfx-engine.ts`).
  - Offline silent audio sprite placeholders (`apps/web/public/sfx/ui-sprite.mp3`, `ui-sprite.webm`) matching exact sprite duration map.
- [x] **C3 — Focus Mode Store & UI**:
  - Fullscreen distraction-free interview and coding arena workspace (`useFocusModeStore.ts`, `useFocusModeHotkey.ts`).
  - Hotkey controls: phím `F` toggle focus mode (bỏ qua khi đang nhập liệu input/textarea/contenteditable), phím `Escape` thoát focus mode tức thì.
  - Tích hợp trên `ArenaWorkspaceView.tsx`, `InterviewRoomPage.tsx`, và floating exit trigger trên `AppLayout.tsx`.

### Đang triển khai / Còn lại (Remaining - Chỉ còn bước ngoại vi của Human Owner)

- [x] **C4 — PWA Local Implementation & Validation**:
  - Đã hoàn thành 100%: Bộ icon đầy đủ chuẩn PWA manifest (`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`, `masked-icon.svg`, `favicon.ico`), cấu hình VitePWA plugin với Workbox runtime caching (`CacheFirst` fonts, `NetworkFirst` flashcards API), offline review queue và auto-sync. Toàn bộ test suite tự động kiểm định đạt 100% green.
  - _Chờ ngoại vi (External)_: Cài đặt và kiểm nghiệm trên thiết bị di động thật sau khi triển khai HTTPS production domain.
- [x] **C5 — Web Push Local Implementation & Tooling**:
  - Đã hoàn thành 100%: Backend push notification service + cron job reminder, frontend banner xin quyền (`PushPermissionBanner.tsx`) tự động ẩn/hiện và lưu dismiss 7 ngày, panel cài đặt (`NotificationSettingsPanel.tsx`), CLI generator VAPID keys (`infra/scripts/generate-vapid-keys.mjs`), và script kiểm tra cấu hình pre-deployment (`infra/scripts/validate-production-config.mjs`). Toàn bộ test suite tự động đạt 100% green.
  - _Chờ ngoại vi (External)_: Cấu hình VAPID keys chính thức trên production server và người dùng thật bấm nút cho phép thông báo trên trình duyệt.

---

## 🧪 Test Integrity & Verification Matrix (Verified 100% Green)

| Package                            | Test Suites    | Tests Count     | Status             |
| ---------------------------------- | -------------- | --------------- | ------------------ |
| `@ai-interview/api` (Backend)      | 177 suites     | 1,131 tests     | ✅ PASS (100%)     |
| `@ai-interview/web` (Frontend)     | 71 suites      | 283 tests       | ✅ PASS (100%)     |
| `@ai-interview/contracts` (Shared) | 2 suites       | 25 tests        | ✅ PASS (100%)     |
| **Monorepo Total**                 | **250 suites** | **1,439 tests** | **✅ PASS (100%)** |
| Typecheck (`pnpm type-check`)      | 5 packages     | 0 errors        | ✅ PASS (100%)     |
| Production Dependency Audit        | 100% audited   | 0 CVEs          | ✅ PASS (100%)     |

---

## 🗄️ Tổng quan Hệ thống Tài liệu

| Thư mục / File                                                 | Mô tả                                                      | Trạng thái                   |
| :------------------------------------------------------------- | :--------------------------------------------------------- | :--------------------------- |
| [`docs/INDEX.md`](docs/INDEX.md)                               | **Master Catalog & Search Index** cho toàn bộ dự án        | ✅ Active                    |
| [`docs/features/`](docs/features/)                             | 17 feature specs (F001–F017) + Feature Index               | ✅ Active — 17/17 hoàn thành |
| [`docs/adr/`](docs/adr/)                                       | Architecture Decision Records 0001–0010                    | ✅ Active                    |
| [`docs/roadmap/`](docs/roadmap/)                               | Kế hoạch phát triển tương lai (Plan B, Plan C)             | 📋 Ready for execution       |
| [`docs/archive/`](docs/archive/)                               | **Kho lưu trữ tổng hợp bugfixes, audit & completed waves** | 🗃️ Master Archive            |
| [`docs/archive/scorecards/`](docs/archive/scorecards/)         | Báo cáo nghiệm thu & Release Gates (151 suites green)      | ✅ Certified                 |
| [`docs/verification-roadmap.md`](docs/verification-roadmap.md) | Quy trình kiểm định 7 tầng & 12 Release Gates              | ✅ Active                    |
| [`docs/architecture.md`](docs/architecture.md)                 | Kiến trúc tổng thể + sequence diagrams                     | ✅ Active                    |
| [`docs/api-conventions.md`](docs/api-conventions.md)           | API error handling & envelope standards                    | ✅ Active                    |
| `ai-it-interview-project-kit/00-15`                            | Đặc tả domain, requirements, architecture (MVP)            | ✅ Active                    |
