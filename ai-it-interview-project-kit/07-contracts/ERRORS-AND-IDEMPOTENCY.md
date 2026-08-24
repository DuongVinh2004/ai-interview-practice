# Errors and idempotency

## Error categories

- `VALIDATION_*`: input không hợp lệ.
- `AUTH_*`: credential/session/MFA.
- `FORBIDDEN` hoặc resource-hidden policy.
- `SESSION_*`: state/ownership/transition.
- `AI_*`: timeout, rate limit, schema, safety, provider unavailable.
- `QUEUE_*`: enqueue/retry/recovery.
- `INTERNAL_*`: message public trung tính, correlation ID.

## Idempotency

- Key có TTL và ràng buộc user + operation + canonical request hash.
- Cùng key khác body trả conflict.
- Response đang xử lý, hoàn tất và thất bại có semantics rõ.
- Record không lưu secret và được cleanup.
- Queue job handler vẫn idempotent; HTTP key không thay thế worker guard.
