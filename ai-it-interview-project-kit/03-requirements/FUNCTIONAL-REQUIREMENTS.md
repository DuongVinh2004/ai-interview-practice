# Functional requirements

## Identity

- `FR-ID-001`: Đăng ký và đăng nhập bằng email/password với lỗi không tiết lộ account existence.
- `FR-ID-002`: Refresh rotation, logout, revoke session và account lock.
- `FR-ID-003`: Candidate xem/quản lý session đăng nhập của mình.
- `FR-ID-004`: Admin bắt buộc enroll MFA và step-up cho hành động nhạy cảm.
- `FR-ID-005`: RBAC kết hợp ownership fail-closed.

## Taxonomy and content

- `FR-TAX-001`: CRUD role, level, technology, competency với validation và unique constraint.
- `FR-TAX-002`: Question bank có workflow review/version/retire.
- `FR-TAX-003`: Rubric và prompt được version, preview và rollback.

## Interview

- `FR-INT-001`: Candidate tạo blueprint hợp lệ từ taxonomy active.
- `FR-INT-002`: Hệ thống tạo session và question snapshot idempotent.
- `FR-INT-003`: Candidate bắt đầu, lưu draft answer, điều hướng và submit.
- `FR-INT-004`: State transition chống double submit, refresh và concurrent request.
- `FR-INT-005`: Session timeout và retry có reason/audit.
- `FR-INT-006`: Text interview hoạt động hoàn chỉnh bằng Việt hoặc Anh.

## AI and evaluation

- `FR-AI-001`: Mở rộng provider adapter hiện có, giữ mock deterministic và chỉ bật provider thật sau decision gate.
- `FR-AI-002`: Generation/evaluation tiếp tục dùng BullMQ durable job có retry, timeout, deterministic job ID và idempotency.
- `FR-AI-003`: Output validate bằng structured schema; invalid output không được lưu làm kết quả cuối.
- `FR-EVL-001`: Chấm từng rubric dimension kèm evidence/confidence.
- `FR-EVL-002`: Low confidence chuyển review/fallback.
- `FR-EVL-003`: Re-evaluation tạo immutable run mới.

## Results and learning

- `FR-RPT-001`: Hiển thị score breakdown, evidence, limitation và action items.
- `FR-RPT-002`: Lịch sử lọc theo role/technology/competency/date.
- `FR-LRN-001`: Tạo competency profile từ đủ số evidence.
- `FR-LRN-002`: Learning plan có goal, task, resource, progress và user override.

## Administration

- `FR-ADM-001`: Quản lý user/role/quota/feature flag với audit.
- `FR-ADM-002`: Dashboard provider latency, error, token/cost và safety event.
- `FR-ADM-003`: Export/delete dữ liệu theo quyền và retention policy.
