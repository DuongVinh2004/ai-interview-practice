# TRUNG TÂM TÀI LIỆU DỰ ÁN — AI INTERVIEW PRACTICE PLATFORM

## Master Documentation Catalog & Search Index

> **Single Source of Truth cho toàn bộ tài liệu kiến trúc, tính năng, roadmap và lịch sử sửa lỗi.**  
> Hướng dẫn tra cứu nhanh cho AI Agent và Lập trình viên.

---

## 🗺️ Bản đồ Chỉ mục Tài liệu (Quick Navigation Matrix)

```
docs/
├── INDEX.md (hoặc README.md)             ← BẠN ĐANG Ở ĐÂY: Master Catalog & Search Index
├── architecture.md                       ← Kiến trúc tổng thể hệ thống & Sequence Diagrams
├── api-conventions.md                    ← Quy chuẩn REST API, Error Envelope & Security Headers
├── verification-roadmap.md               ← Roadmap kiểm định 7 tầng & 12 Release Gates
│
├── adr/                                  ← ARCHITECTURE DECISION RECORDS (ADR 0001 → 0009)
│   ├── 0001-modular-monolith-architecture.md
│   ├── 0002-server-sent-events-with-polling-fallback.md
│   ├── 0003-ai-provider-abstraction.md
│   ├── 0004-answer-persistence-before-enqueue.md
│   ├── 0005-semantic-cache-vector-store.md
│   ├── 0006-payment-gateway-selection.md
│   ├── 0007-file-parsing-strategy.md
│   ├── 0008-websocket-gateway-architecture.md
│   └── 0009-whiteboard-canvas-vision.md
│
├── features/                             ← ĐẶC TẢ TÍNH NĂNG CHI TIẾT (F001 → F016)
│   ├── FEATURE-ROADMAP-INDEX.md          ← Master Index của 16 Features
│   ├── IMPLEMENTATION-GUIDE.md           ← Quy trình chuẩn khi phát triển & test module
│   ├── PARALLEL-EXECUTION-PROMPTS.md     ← Mẫu prompt thực thi song song
│   ├── F001-VOICE-REALTIME-INTERVIEW.md  ← Phỏng vấn giọng nói Full-Duplex thời gian thực
│   ├── F002-LIVE-CODING-SANDBOX.md       ← Sandbox chạy code tương tác (Monaco + Judge0)
│   ├── F003-SYSTEM-DESIGN-WHITEBOARD.md  ← Bảng vẽ kiến trúc System Design + Vision AI
│   ├── F004-JD-RESUME-TAILORED-INTERVIEW.md ← Trích xuất CV/JD & phỏng vấn may đo
│   ├── F005-SPACED-REPETITION-FLASHCARDS.md ← Lặp lại ngắt quãng FSRS v4 & Smart Flashcards
│   ├── F006-SOCRATIC-AI-TUTOR.md         ← Gia sư AI Socratic & làm lại câu hỏi tức thì
│   ├── F007-BEHAVIORAL-STAR-INTERVIEW.md ← Phỏng vấn hành vi & chấm điểm 5 trục STAR
│   ├── F008-SKILL-GRAPH-BENCHMARK.md     ← Skill Graph & Định vị phần trăm năng lực
│   ├── F009-READINESS-SCORE.md           ← Điểm số sẵn sàng & Dự đoán đỗ Offer
│   ├── F010-VERIFIED-PORTFOLIO-CERTIFICATE.md ← Portfolio & Chứng chỉ số HMAC xác thực
│   ├── F011-B2B-MULTI-TENANT.md          ← Nền tảng B2B đa doanh nghiệp & Workspace
│   ├── F012-MENTOR-COPILOT.md            ← Trợ lý phỏng vấn dành cho Mentor
│   ├── F013-SEMANTIC-CACHE-LLM-ROUTER.md ← Cache ngữ nghĩa SHA-256/Embedding & LLM Router
│   ├── F014-SUBSCRIPTION-BILLING.md      ← Quản lý gói cước Stripe/PayOS & Hạn mức
│   ├── F015-QUESTION-BANK.md             ← Ngân hàng câu hỏi & Quy trình kiểm duyệt 5 bước
│   └── F016-SAVED-INTERVIEW-CONFIGURATIONS.md ← Lưu & tái sử dụng cấu hình phỏng vấn
│
├── roadmap/                              ← KẾ HOẠCH & ROADMAP PHÁT TRIỂN TƯƠNG LAI
│   ├── PLAN-B-REAL-CLOUD-AND-VOICE.md    ← Tích hợp Cloud thật (S3/R2, Deepgram, ElevenLabs, VietQR)
│   ├── PLAN-C-GAMIFICATION-UX-PWA.md     ← Gamification (XP/Streak), PWA, SFX, Push Notifications
│   └── UIUX-PLAN-B-C-CROSS-REFERENCE.md  ← Bảng đối chiếu chéo & lộ trình tích hợp Plan B + Plan C
│
└── archive/                              ← KHO LƯU TRỮ TỐI ƯU CÁC KẾ HOẠCH & BUG ĐÃ LÀM
    ├── COMPLETED-TASKS-AND-BUGS-ARCHIVE.md ← BẢNG TỔNG HỢP TOÀN BỘ BUG VÀ BIỆN PHÁP KHẮC PHỤC (25-27/8)
    ├── COMPLETED-WAVES-SUMMARY.md        ← TỔNG KẾT TRIỂN KHAI HOÀN TẤT MVP & WAVES 1-4
    └── scorecards/                       ← Báo cáo kiểm định chất lượng & Release Gates
        ├── 2026-08-27-EVALUATION-EXECUTION-SCORECARD.md ← Scorecard nghiệm thu 151 suites (100% Pass)
        ├── baseline-audit.md             ← Báo cáo đánh giá UI/UX ban đầu
        └── release-gate-report.md        ← Báo cáo tổng duyệt Release Gates
```

---

## 🔍 Hướng dẫn Tra cứu Nhanh cho AI theo Chủ đề

| Bạn cần tìm thông tin về...                   | Đọc ngay tài liệu này                                                                                                              | Ghi chú                                                                                                          |
| :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **Trạng thái tổng thể & số lượng test**       | [PROJECT-STATUS.md](../PROJECT-STATUS.md)                                                                                          | Single Source of Truth ở thư mục gốc                                                                             |
| **Lịch sử sửa lỗi bảo mật, auth, session**    | [archive/COMPLETED-TASKS-AND-BUGS-ARCHIVE.md](archive/COMPLETED-TASKS-AND-BUGS-ARCHIVE.md)                                         | Chứa toàn bộ root cause, code fix, spec test                                                                     |
| **Chi tiết tính năng MVP & Waves 1–4**        | [archive/COMPLETED-WAVES-SUMMARY.md](archive/COMPLETED-WAVES-SUMMARY.md)                                                           | Tóm tắt các module, công nghệ đã bàn giao                                                                        |
| **Đặc tả nghiệp vụ / API / Schema tính năng** | `features/F001` → `F016`                                                                                                           | Xem mục lục tại [features/FEATURE-ROADMAP-INDEX.md](features/FEATURE-ROADMAP-INDEX.md)                           |
| **Lý do đưa ra quyết định kỹ thuật**          | `adr/0001` → `0009`                                                                                                                | Xem danh mục ADR tại [features/FEATURE-ROADMAP-INDEX.md#quyết-định-kiến-trúc](features/FEATURE-ROADMAP-INDEX.md) |
| **Kế hoạch nâng cấp Cloud / Voice / VietQR**  | [roadmap/PLAN-B-REAL-CLOUD-AND-VOICE.md](roadmap/PLAN-B-REAL-CLOUD-AND-VOICE.md)                                                   | Kế hoạch Plan B chi tiết                                                                                         |
| **Kế hoạch Gamification / PWA / Streak**      | [roadmap/PLAN-C-GAMIFICATION-UX-PWA.md](roadmap/PLAN-C-GAMIFICATION-UX-PWA.md)                                                     | Kế hoạch Plan C chi tiết                                                                                         |
| **Tiêu chí nghiệm thu 12 Release Gates**      | [verification-roadmap.md](verification-roadmap.md)                                                                                 | 7 tầng kiểm định chất lượng nghiêm ngặt                                                                          |
| **Bằng chứng test thực thi 100% Pass**        | [archive/scorecards/2026-08-27-EVALUATION-EXECUTION-SCORECARD.md](archive/scorecards/2026-08-27-EVALUATION-EXECUTION-SCORECARD.md) | Kết quả chạy thực tế 714 test cases                                                                              |
