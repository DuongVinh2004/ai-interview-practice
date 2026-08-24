# Queue and concurrency tests

## Invariants

- An interview has one legal state at a time and only declared transitions.
- A submitted answer is immutable; an edit is a new version before finalization.
- Each logical evaluation has one idempotency key and at most one active canonical result.
- Completion is committed once; duplicate/reordered events do not double-charge quota.
- A worker cannot publish a result for a stale session/question/rubric version.

## Test scenarios

Run against real Redis/BullMQ and PostgreSQL:

- Ten parallel answer submissions with the same idempotency key.
- Worker crash before/after external provider call and before/after DB commit.
- Duplicate, delayed, and out-of-order jobs/events.
- Two workers finalizing one session.
- Retry after provider timeout versus provider success with lost response.
- Queue pause, Redis restart, poison message, dead-letter/replay, and max-attempt exhaustion.
- Transaction deadlock/serialization retry and optimistic-version conflict.
- Cancellation/deletion while evaluation is queued or running.

## Assertions

Verify final state, canonical rows, usage ledger, audit sequence, notification count, dead-letter metadata, and absence of orphaned locks. Load tests measure queue age and recovery after backlog, not only request throughput.
