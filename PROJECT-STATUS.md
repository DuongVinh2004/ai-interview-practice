# Trạng thái Dự án — AI Interview Practice

> **Cập nhật lần cuối**: 2026-08-24  
> **Repo**: [DuongVinh2004/ai-interview-practice](https://github.com/DuongVinh2004/ai-interview-practice)

Tài liệu này là **single source of truth** cho trạng thái triển khai dự án. Phân biệt rõ **đã hoàn thành** (có code + tests) và **chưa làm** (chỉ có tài liệu đặc tả).

---

## ✅ ĐÃ HOÀN THÀNH — MVP (Milestones M0 → M5)

### Codebase Foundation
- [x] Monorepo pnpm workspaces (`apps/api`, `apps/web`, `packages/*`)
- [x] NestJS 11 Modular Monolith — 10 modules: `auth`, `profile`, `taxonomy`, `interview`, `ai-orchestrator`, `evaluation`, `learning-path`, `history-report`, `admin`, `platform`
- [x] React 18 + Vite + TypeScript + Tailwind CSS + TanStack Query + Zustand
- [x] PostgreSQL 16 + Prisma 6 ORM (1 migration, idempotent seed)
- [x] Redis 7 + BullMQ (3 queues: question-generation, answer-evaluation, learning-path)
- [x] Shared contracts package (`@ai-interview/contracts`) — Zod schemas, enums, types
- [x] Docker Compose multi-container environment
- [x] Nginx reverse proxy (SSE buffering off)

### Identity & Access (Epics E02, E03)
- [x] Email/password registration & login (bcrypt, no account enumeration)
- [x] JWT access token (15 min) + refresh token rotation (7 days)
- [x] Token replay detection → revoke entire session family + audit log
- [x] TOTP MFA setup/enable/verify/disable (RFC 6238, ±1 step window)
- [x] 8 single-use bcrypt-hashed recovery codes
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
- [x] ADRs 0001–0004

### Profile & GDPR
- [x] Profile management (full name, target role, level, bio)
- [x] Competency benchmarks
- [x] Full GDPR data portability export (JSON)

### Testing (225+ tests total)
- [x] 167 backend tests (42 suites) — unit, integration, AI eval, chaos, code execution, STAR, billing, document-parser, tutor, flashcards, voice gateway
- [x] 50 frontend tests (22 suites) — components, flows, charts, code editor, STAR guide, pricing, cv/jd parser, tutor, retry, flashcards, voice streaming
- [x] 8 contract tests (1 suite)
- [x] Playwright E2E happy path
- [x] 0 lint errors, 0 typecheck errors, monorepo build 100% green

### Phase 2 — Wave 1 Features (Completed)
- [x] **F013 — Semantic Caching & LLM Fallback Router**: SHA-256 + embedding vector similarity caching, cache hits metrics, admin invalidation endpoints, zero-cost fallback, ADR 0005.
- [x] **F002 — Interactive Live Coding & Execution Sandbox**: Monaco editor, Mock & Judge0 execution providers, AST Big-O complexity reviewer, split-pane IDE in `InterviewRoomPage`.
- [x] **F007 — Behavioral Interview & STAR Method Assessment**: 5-axis STAR scoring rubric, real-time proactive probing generator, `StarGuidePanel`, `StarRadarChart`, `StarAnnotationView`.
- [x] **F014 — Subscription & Usage-Based Billing**: Multi-tier plans (Free, Pro, Team, Enterprise), Mock & Stripe checkout & portal sessions, `UsageMeterService` with monthly quota enforcement, `QuotaGuard`, `PricingPage`, `BillingDashboardPage`, ADR 0006.

### Phase 2 — Wave 2 Features (Completed)
- [x] **F004 — JD & Resume Parsing for Tailored Interview**: In-memory PDF/DOCX text extraction, PII regex scrubber, entity extraction & gap analysis, weighted blueprint generator, ADR 0007.
- [x] **F006 — Socratic AI Tutor & Instant Question Retry**: Socratic dialogue system prompt, SSE stream chat (max 20 turns), instant retry rubric score comparison with improvement badge, tutor rating.
- [x] **F005 — Spaced Repetition Drills & Smart Flashcards**: Pure TypeScript FSRS v4 algorithm engine (Difficulty, Stability, Retrievability), 3D flip card, review queue with keyboard shortcuts (Space, 1-4), streak heatmap calendar, auto-generation from interview weaknesses.
- [x] **F001 — Full-Duplex Live Voice Streaming Interview**: Low-latency WebSocket voice gateway (`@nestjs/websockets` + `ws`), energy-based VAD & barge-in interrupt detection, real-time audio visualizer & live transcript rolling feed, ADR 0008.

---

## 📋 TIẾP THEO — Phase 2 Features Còn lại (Wave 3)

Tất cả tính năng dưới đây có tài liệu đặc tả chi tiết tại `docs/features/`.

### 🔵 Ưu tiên P3 — Medium-term (Wave 3)
| ID | Tính năng | Trạng thái | Đặc tả |
|---|---|---|---|
| F008 | Skill Graph & Benchmark | ⬜ Chưa bắt đầu | [F008](docs/features/F008-SKILL-GRAPH-BENCHMARK.md) |
| F009 | Readiness Score & Predictor | ⬜ Chưa bắt đầu | [F009](docs/features/F009-READINESS-SCORE.md) |
| F010 | Portfolio & Certificate | ⬜ Chưa bắt đầu | [F010](docs/features/F010-VERIFIED-PORTFOLIO-CERTIFICATE.md) |
| F003 | System Design Whiteboard | ⬜ Chưa bắt đầu | [F003](docs/features/F003-SYSTEM-DESIGN-WHITEBOARD.md) |
| F012 | Mentor Co-Pilot | ⬜ Chưa bắt đầu | [F012](docs/features/F012-MENTOR-COPILOT.md) |
| F011 | B2B Multi-Tenant | ⬜ Chưa bắt đầu | [F011](docs/features/F011-B2B-MULTI-TENANT.md) |

---

## 🗄️ Tổng quan Tài liệu

| Thư mục | Mô tả | Trạng thái |
|---|---|---|
| `docs/features/` | 14 feature specs + roadmap index | ✅ Active — 4/14 hoàn thành (Wave 1) |
| `docs/adr/` | Architecture Decision Records 0001–0006 | ✅ Active (Thêm ADR 0005, 0006) |
| `docs/architecture.md` | Kiến trúc tổng thể + sequence diagrams | ✅ Active |
| `docs/api-conventions.md` | API error handling & envelope standards | ✅ Active |
| `ai-it-interview-project-kit/00-15` | Đặc tả domain, requirements, architecture (MVP) | ✅ Active — source-of-truth cho domain rules |
| `ai-it-interview-project-kit/_archived/` | ChatGPT Supervisor Protocol (workflow cũ) | 🗄️ Archived |

---

## 📖 Hướng dẫn bắt đầu Feature mới

→ Xem **[IMPLEMENTATION-GUIDE.md](docs/features/IMPLEMENTATION-GUIDE.md)** để biết quy trình chuẩn.

→ Xem **[FEATURE-ROADMAP-INDEX.md](docs/features/FEATURE-ROADMAP-INDEX.md)** để xem dependency graph và lộ trình.
