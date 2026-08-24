# Index and concurrency

## Index bắt buộc theo access pattern

- Session: `(user_id, created_at desc)`, `(state, updated_at)`, active sessions theo user.
- Turn: unique `(session_id, turn_number)`.
- Answer: unique `turn_id` cho first-final-answer model.
- Evaluation run: `(answer_id, created_at desc)`, unique active/final constraint theo policy.
- Refresh token: unique hash/jti; `(session_id, revoked_at)`.
- Audit: `(user_id, created_at desc)`, `(action, created_at desc)`.
- AI run: `(provider, model, status, created_at)` và `(session_id, created_at)`.
- Idempotency: `(user_id, resource, key)` unique + expiry cleanup.

## Concurrency patterns

- Conditional update `WHERE state = expected AND version = expectedVersion`.
- Unique constraint là final guard cho duplicate answer/job intent.
- Transaction không bao quanh external AI call.
- Queue handler đọc current state và no-op an toàn nếu job đã hoàn tất.
- Quota ledger dùng atomic insert/transaction, không read-then-write không khóa.
