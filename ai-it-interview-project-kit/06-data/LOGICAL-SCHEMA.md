# Logical schema target

## Identity

- `users`: role, status, credential version, verified timestamp.
- `user_profiles`: display/goal fields; không trộn credential.
- `auth_sessions`: session family, device metadata tối thiểu, last seen, revoked reason.
- `refresh_tokens`: hash, session ID, jti, rotated/revoked timestamps.
- `mfa_factors`: type, encrypted secret reference, verified timestamp.
- `recovery_codes`: one-way hash, used timestamp.

## Interview

- `interview_sessions`: owner, blueprint snapshot, state, version, deadlines.
- `session_technologies`: normalized selection.
- `interview_turns`: order, status, difficulty, competency snapshot.
- `questions`: content, expected concepts, source/generation metadata.
- `answers`: immutable submitted content; draft tách nếu cần.

## Evaluation and learning

- `rubrics` và `rubric_versions`.
- `evaluation_runs`: answer, rubric/model/prompt/schema version, status, score, confidence.
- `evaluation_dimensions` và `evidence_spans` nếu cần query/audit chi tiết.
- `learning_plans`, `learning_items`, `competency_snapshots`.

## Platform

- `prompt_versions`, `ai_runs`, `job_recovery_records`, `idempotency_records`, `audit_logs`, `feature_flags`, `quota_ledgers`.

JSON chỉ dùng cho payload linh hoạt có schema/version; state, ownership, score và audit key phải query/index được.
