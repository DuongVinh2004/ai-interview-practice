# Data and AI requirements

- `AIR-001`: Mọi AI request có correlation ID, use-case, model config, prompt version và policy version.
- `AIR-002`: Prompt không chứa dữ liệu vượt mục đích tối thiểu.
- `AIR-003`: Provider retention/training setting phải được ghi nhận trước production.
- `AIR-004`: Structured output schema validate trước business logic.
- `AIR-005`: Model không tự thay taxonomy, rubric, score weights hoặc user role.
- `AIR-006`: Prompt injection trong answer bị xem là dữ liệu candidate, không phải instruction.
- `AIR-007`: Golden set tách train/development/test và version bất biến.
- `AIR-008`: Eval có slice theo ngôn ngữ, role, level, question format và answer length.
- `AIR-009`: Chỉ rollout model/prompt mới khi không phá quality/safety/cost gate.
- `PRV-001`: User xem, export và yêu cầu xóa dữ liệu theo policy.
- `PRV-002`: Raw transcript mặc định 365 ngày; audio Phase 2 mặc định 30 ngày, có thể cấu hình theo legal review.
- `PRV-003`: Audit bảo mật giữ tối thiểu theo policy nhưng phải redaction.
- `PRV-004`: Dữ liệu dùng cho eval/fine-tune cần de-identification và quyền sử dụng riêng.
