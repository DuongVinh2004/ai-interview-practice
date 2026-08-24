# Interview lifecycle

## State machine mục tiêu

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> GENERATING: start
    GENERATING --> READY: questions ready
    GENERATING --> FAILED: exhausted retries
    READY --> IN_PROGRESS: begin
    IN_PROGRESS --> SUBMITTED: submit or timeout
    SUBMITTED --> EVALUATING: job claimed
    EVALUATING --> COMPLETED: evaluation stored
    EVALUATING --> REVIEW_REQUIRED: low confidence
    EVALUATING --> FAILED: exhausted retries
    REVIEW_REQUIRED --> COMPLETED: approved or rerun
    COMPLETED --> [*]
    FAILED --> GENERATING: retry generation
    FAILED --> EVALUATING: retry evaluation
```

## Invariants

- Mọi transition là conditional update theo current state và version.
- `submit` idempotent; cùng idempotency key trả cùng kết quả.
- Question và rubric được snapshot vào session để lịch sử không đổi khi content cập nhật.
- Candidate chỉ đọc/ghi session mình sở hữu.
- Evaluation không sửa attempt gốc.
- Retry không tạo duplicate question, evaluation hoặc quota charge.
- Timeout phải dùng server time và audit reason.
