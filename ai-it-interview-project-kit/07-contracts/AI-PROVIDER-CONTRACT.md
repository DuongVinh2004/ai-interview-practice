# AI provider contract

Provider adapter phải hỗ trợ:

- `generateQuestion(context, prompt)`.
- `evaluateAnswer(context, prompt, rubric)`.
- `generateLearningPath(context, prompt)`.
- Abort/timeout, retry classification và rate-limit metadata.
- Structured output hoặc parse/validation trước khi trả domain.
- Usage: model, tokens/units, latency, cost estimate, request ID.

## Error taxonomy

`TIMEOUT`, `RATE_LIMITED`, `AUTH_FAILED`, `CONTENT_BLOCKED`, `SCHEMA_INVALID`, `TRANSIENT_UPSTREAM`, `PERMANENT_UPSTREAM`, `BUDGET_EXCEEDED`.

Không retry auth, safety hoặc schema lỗi vô hạn. Provider response không được log raw khi chứa user content. Adapter phải map lỗi vendor sang taxonomy nội bộ.
