# Trạng thái Dự án — AI Interview Practice

> **Cập nhật lần cuối**: 2026-08-24  
> **Repo**: [DuongVinh2004/ai-interview-practice](https://github.com/DuongVinh2004/ai-interview-practice)

Tài liệu này là **single source of truth** cho trạng thái triển khai dự án. Tất cả tính năng dưới đây đã có **code thật + automated tests verified** trong monorepo.

---

## 🛡️ BẢN VÁ BẢO MẬT & HARDENING (Ultra Strict Audit Remediation)

- [x] **BLOCKER-001 (Voice Gateway WebSocket Security)**: Bắt buộc xác thực JWT trên kết nối WebSocket handshake và `voice:connect`. Kiểm tra quyền sở hữu phiên phỏng vấn (`interview.userId === authenticatedUser.id`), ngắt kết nối với mã `1008 Forbidden` nếu vi phạm. Thắt chặt CORS allowlist.
- [x] **CRITICAL-001 (Document Blueprint IDOR / BOLA Prevention)**: Thêm xác thực quyền sở hữu `userId` trong `GET /documents/blueprints/:id` và `DocumentParserService.getBlueprint()`.
- [x] **CRITICAL-002 (Stripe Webhook Signature Verification)**: Cài đặt xác thực chữ ký mật mã HMAC-SHA256 (`stripe-signature` timestamp & hash tolerance) với `STRIPE_WEBHOOK_SECRET`.
- [x] **HIGH-001 (Atomic Billing Quota Enforcement)**: Thay thế TOCTOU bằng `UsageMeterService.checkAndConsumeQuota()` chạy trong interactive transaction.
- [x] **HIGH-002 (Atomic Recovery Code Consumption)**: Áp dụng atomic conditional update (`WHERE id = ? AND isUsed = false`) ngăn chặn race condition khi sử dụng recovery code đồng thời.
- [x] **HIGH-003 & HIGH-004 (Judge0 Sandbox Fail-Closed & Test Cases)**: Chuyển provider sang fail-closed khi thiếu URL/config, chạy và so sánh kết quả thực thi từng testcase với `expectedOutput`.
- [x] **HIGH-005 (Secure Upload Boundary)**: Cấu hình Multer file size limit (5MB), MIME type filtering, và kiểm tra magic-bytes (PDF `%PDF-`, DOCX `PK\x03\x04`).
- [x] **HIGH-006 (Stripe Checkout Line Items)**: Truyền đúng `stripePriceId` tương ứng với chu kỳ thanh toán vào `line_items` của checkout session.

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

### Interview Core (Epic E04)
- [x] Session state machine: `CREATED → ACTIVE → EVALUATING → COMPLETED/CANCELLED/FAILED`
- [x] 3 session modes: `STANDARD` (5 turns), `FOCUSED_REMEDIATION`, `QUICK_PRACTICE`
- [x] Adaptive difficulty: score ≥ 7.5 → step up, ≤ 4.0 → step down
- [x] Answer persistence before BullMQ enqueue (ADR 0004)
- [x] `Idempotency-Key` HTTP header support
- [x] SSE real-time events + REST polling fallback (`/interviews/:id/status`)
- [x] Sandbox mode (sessions don't affect progress)

### AI & Evaluation (Epics E06, E07, E08)
- [x] Provider abstraction interface (`AiProvider`)
- [x] 4 providers: `MockAiProvider` (deterministic), `GeminiProvider`, `OpenAiProvider`, `AnthropicProvider`
- [x] Provider Router with circuit breakers (5 failures → 30s trip) + daily cost budget
- [x] Prompt Registry & version management
- [x] AI Security Filter — pre-filter (injection detection) + post-filter (evidence verification, range check)
- [x] Zod schema validation on all AI outputs
- [x] Rubric scoring: Technical Accuracy, Depth, Clarity (weighted: 0.5/0.3/0.2)
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

---

## 🧪 Test Integrity & Verification Matrix (Verified 100% Green)

| Package | Test Suites | Tests Count | Status |
|---|---|---|---|
| `@ai-interview/api` (Backend) | 48 suites | 216 tests | ✅ PASS (100%) |
| `@ai-interview/web` (Frontend) | 28 suites | 73 tests | ✅ PASS (100%) |
| `@ai-interview/contracts` (Shared) | 1 suite | 10 tests | ✅ PASS (100%) |
| **Monorepo Total** | **77 suites** | **299 tests** | **✅ PASS (100%)** |
| Typecheck (`pnpm type-check`) | 5 packages | 0 errors | ✅ PASS (100%) |

---

## 🗄️ Tổng quan Tài liệu

| Thư mục | Mô tả | Trạng thái |
|---|---|---|
| `docs/features/` | 14 feature specs + roadmap index | ✅ Active — 14/14 hoàn thành (Waves 1–4) |
| `docs/adr/` | Architecture Decision Records 0001–0008 | ✅ Active (Thêm ADR 0005, 0006, 0007, 0008) |
| `docs/architecture.md` | Kiến trúc tổng thể + sequence diagrams | ✅ Active |
| `docs/api-conventions.md` | API error handling & envelope standards | ✅ Active |
| `ai-it-interview-project-kit/00-15` | Đặc tả domain, requirements, architecture (MVP) | ✅ Active — source-of-truth cho domain rules |

