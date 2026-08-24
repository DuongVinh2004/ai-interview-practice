# Non-functional requirements

## Performance and scale

- `NFR-PERF-001`: API synchronous p95 < 300 ms và p99 < 800 ms ở launch profile, không tính provider AI.
- `NFR-PERF-002`: Generation job p95 < 15 giây; evaluation p95 < 20 giây, có timeout/fallback.
- `NFR-SCL-001`: Launch profile: 10.000 MAU, 500 text sessions đồng thời, 50 AI jobs đồng thời.
- `NFR-SCL-002`: Stateless API scale ngang; worker scale theo queue depth và provider quota.
- `NFR-SCL-003`: Backpressure ngăn retry storm và quota exhaustion.

## Availability and resilience

- `NFR-REL-001`: API core SLO 99,9% theo tháng; error budget được theo dõi.
- `NFR-REL-002`: AI provider lỗi không làm mất attempt; session chuyển trạng thái recoverable.
- `NFR-REL-003`: Mọi mutation quan trọng idempotent hoặc có concurrency guard.
- `NFR-DR-001`: Tier-1 RPO ≤ 15 phút, RTO ≤ 60 phút; restore drill ít nhất mỗi quý.

## Maintainability

- `NFR-MNT-001`: Module có owner, public contract và không import model chéo context.
- `NFR-MNT-002`: ADR bắt buộc cho dependency/runtime/database/queue/provider mới.
- `NFR-MNT-003`: Code coverage là guardrail kết hợp mutation/critical-path tests, không chạy theo phần trăm hình thức.
- `NFR-MNT-004`: API/event/schema có compatibility và deprecation window.

## Security and privacy

- `NFR-SEC-001`: ASVS 5.0 Level 2 là baseline mục tiêu cho luồng chính.
- `NFR-SEC-002`: Secret không nằm trong repo/log/client bundle.
- `NFR-PRV-001`: Data minimization, purpose limitation, retention và deletion có evidence.
- `NFR-PRV-002`: Transcript/voice mã hóa khi truyền và lưu trữ.

## Accessibility and localization

- `NFR-A11Y-001`: WCAG 2.2 AA target cho luồng candidate.
- `NFR-I18N-001`: UI, content, error và AI output hỗ trợ Việt–Anh, không hard-code chuỗi mới.
