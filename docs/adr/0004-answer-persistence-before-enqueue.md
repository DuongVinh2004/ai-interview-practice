# ADR 0004: Answer Persistence Prior to Async Enqueue

## Status

Accepted

## Context

When a candidate submits a text answer, the evaluation process is asynchronous and handled by background BullMQ workers. If the worker queue experiences delays, redis memory restarts, or temporary AI provider outages, candidate answers must never be lost.

## Decision

1. When `POST /interviews/:id/answers` is received, the application **persists the candidate's Answer record into PostgreSQL first** inside an atomic transaction.
2. The session state is transitioned from `ACTIVE` to `EVALUATING`, and the turn status is set to `ANSWER_SUBMITTED`.
3. Only after the database transaction commits successfully is the `evaluate-answer` BullMQ job enqueued with a deterministic job ID.
4. If the AI evaluation fails after maximum retries (2 retries with exponential backoff), the session state transitions to `FAILED`, but the candidate's persisted answer remains intact in the database for manual or automatic retry.

## Consequences

- **Positive**: Zero candidate data loss risk; predictable audit trail; crash tolerance across Redis restarts.
- **Negative**: Requires handling intermediate `EVALUATING` state if a worker crashes before processing.
