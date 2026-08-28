# Feature Roadmap & Specification Index — AI Interview Practice Platform

> **Cập nhật**: 2026-08-27  
> **Tổng số Feature Specs**: 16 Specs  
> **Trạng thái thực thi**: ✅ **16/16 Hoàn thành & Verified 100%** (Phase 1 MVP + Phase 2 Waves 1–4 + F015, F016)

---

## 📋 Tổng quan Danh mục Tính năng

Tài liệu này là **Master Index** cho toàn bộ 16 đặc tả tính năng của nền tảng **AI Interview Practice Platform**. Tất cả tính năng dưới đây đã có mã nguồn hoàn chỉnh, kiến trúc chuẩn mực và 100% automated tests green trong monorepo.

---

## 🗺️ Ma trận Tính năng & Trạng thái Triển khai

### Trụ cột 1: Trải nghiệm Phỏng vấn Thực tế & AI Đột phá

| ID       | Tính năng                                   | Đặc tả chi tiết                                                              |  Trạng thái   | Module phụ trách                         |
| :------- | :------------------------------------------ | :--------------------------------------------------------------------------- | :-----------: | :--------------------------------------- |
| **F001** | Full-Duplex Live Voice Streaming Interview  | [F001-VOICE-REALTIME-INTERVIEW.md](F001-VOICE-REALTIME-INTERVIEW.md)         | ✅ Hoàn thành | `voice-gateway` (WebSocket, VAD, Opus)   |
| **F002** | Interactive Live Coding & Execution Sandbox | [F002-LIVE-CODING-SANDBOX.md](F002-LIVE-CODING-SANDBOX.md)                   | ✅ Hoàn thành | `code-execution` (Monaco, Judge0)        |
| **F003** | System Design Interactive Whiteboard        | [F003-SYSTEM-DESIGN-WHITEBOARD.md](F003-SYSTEM-DESIGN-WHITEBOARD.md)         | ✅ Hoàn thành | `system-design` (Canvas, Vision AI)      |
| **F004** | JD & Resume Parsing for Tailored Interview  | [F004-JD-RESUME-TAILORED-INTERVIEW.md](F004-JD-RESUME-TAILORED-INTERVIEW.md) | ✅ Hoàn thành | `document-parser` (PDF/DOCX, PII filter) |

---

### Trụ cột 2: Cá nhân hóa Học tập & Khắc phục Lỗ hổng

| ID       | Tính năng                                     | Đặc tả chi tiết                                                                  |  Trạng thái   | Module phụ trách                       |
| :------- | :-------------------------------------------- | :------------------------------------------------------------------------------- | :-----------: | :------------------------------------- |
| **F005** | Spaced Repetition Drills & Smart Flashcards   | [F005-SPACED-REPETITION-FLASHCARDS.md](F005-SPACED-REPETITION-FLASHCARDS.md)     | ✅ Hoàn thành | `learning-path` (FSRS v4 engine)       |
| **F006** | Socratic AI Tutor & Instant Question Retry    | [F006-SOCRATIC-AI-TUTOR.md](F006-SOCRATIC-AI-TUTOR.md)                           | ✅ Hoàn thành | `ai-orchestrator`, `evaluation`        |
| **F007** | Behavioral Interview & STAR Method Assessment | [F007-BEHAVIORAL-STAR-INTERVIEW.md](F007-BEHAVIORAL-STAR-INTERVIEW.md)           | ✅ Hoàn thành | `taxonomy`, `evaluation` (5-axis STAR) |
| **F016** | Saved Interview Configurations & Presets      | [F016-SAVED-INTERVIEW-CONFIGURATIONS.md](F016-SAVED-INTERVIEW-CONFIGURATIONS.md) | ✅ Hoàn thành | `interview`, `taxonomy`                |

---

### Trụ cột 3: Đo lường Năng lực & Thị trường

| ID       | Tính năng                                         | Đặc tả chi tiết                                                                  |  Trạng thái   | Module phụ trách                        |
| :------- | :------------------------------------------------ | :------------------------------------------------------------------------------- | :-----------: | :-------------------------------------- |
| **F008** | Skill Graph & Candidate Benchmark Percentile      | [F008-SKILL-GRAPH-BENCHMARK.md](F008-SKILL-GRAPH-BENCHMARK.md)                   | ✅ Hoàn thành | `skill-graph` (Graph traversal, decay)  |
| **F009** | AI Interview Readiness Score & Offer Predictor    | [F009-READINESS-SCORE.md](F009-READINESS-SCORE.md)                               | ✅ Hoàn thành | `readiness` (Weighted confidence index) |
| **F010** | Verified Public Portfolio & Shareable Certificate | [F010-VERIFIED-PORTFOLIO-CERTIFICATE.md](F010-VERIFIED-PORTFOLIO-CERTIFICATE.md) | ✅ Hoàn thành | `portfolio` (HMAC cryptographic cert)   |

---

### Trụ cột 4: Doanh nghiệp & Giáo dục (B2B)

| ID       | Tính năng                              | Đặc tả chi tiết                                      |  Trạng thái   | Module phụ trách                           |
| :------- | :------------------------------------- | :--------------------------------------------------- | :-----------: | :----------------------------------------- |
| **F011** | B2B Multi-Tenant Dashboard & Workspace | [F011-B2B-MULTI-TENANT.md](F011-B2B-MULTI-TENANT.md) | ✅ Hoàn thành | `b2b` (RLS tenant isolation, assignments)  |
| **F012** | Human-in-the-Loop Mentor Co-Pilot      | [F012-MENTOR-COPILOT.md](F012-MENTOR-COPILOT.md)     | ✅ Hoàn thành | `mentor`, `share` (Live probing generator) |

---

### Trụ cột 5: Tối ưu Kỹ thuật & Quản trị Nội dung

| ID       | Tính năng                              | Đặc tả chi tiết                                                        |  Trạng thái   | Module phụ trách                           |
| :------- | :------------------------------------- | :--------------------------------------------------------------------- | :-----------: | :----------------------------------------- |
| **F013** | Semantic Caching & LLM Fallback Router | [F013-SEMANTIC-CACHE-LLM-ROUTER.md](F013-SEMANTIC-CACHE-LLM-ROUTER.md) | ✅ Hoàn thành | `ai-orchestrator` (Vector cache, Breakers) |
| **F014** | Subscription & Usage-Based Billing     | [F014-SUBSCRIPTION-BILLING.md](F014-SUBSCRIPTION-BILLING.md)           | ✅ Hoàn thành | `billing` (Stripe, PayOS, Quota ledger)    |
| **F015** | Question Bank & Content Governance     | [F015-QUESTION-BANK.md](F015-QUESTION-BANK.md)                         | ✅ Hoàn thành | `question-bank` (5-step review lifecycle)  |

---

## 📁 Tài liệu Quy trình & Hướng dẫn Kỹ thuật

- [IMPLEMENTATION-GUIDE.md](IMPLEMENTATION-GUIDE.md) — Hướng dẫn quy chuẩn triển khai module và tích hợp.
- [PARALLEL-EXECUTION-PROMPTS.md](PARALLEL-EXECUTION-PROMPTS.md) — Mẫu prompt thực thi song song các task chuyên biệt.
- [Architecture Decision Records (ADRs)](../adr/) — Tổng hợp các quyết định kiến trúc từ ADR-0001 đến ADR-0009.
- [Kiến trúc Tổng thể Hệ thống](../architecture.md) — Sơ đồ kiến trúc NestJS Modular Monolith và chu trình dữ liệu.
