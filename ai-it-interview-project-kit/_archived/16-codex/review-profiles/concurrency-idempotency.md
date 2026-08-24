# Review profile: concurrency/idempotency/queues

Activate for state transitions, refresh rotation, submissions, async jobs, retries, queues, workers, billing-like counters/quotas, or any operation that can be delivered more than once.

Check at minimum:

- duplicate request with same idempotency key/request identity;
- two concurrent requests against the same mutable state;
- transaction/locking/optimistic concurrency or unique-constraint behavior;
- retry after timeout when first attempt may already have succeeded;
- queue redelivery and worker crash between side effect and acknowledgement;
- poison-message/max-retry/dead-letter behavior when applicable;
- idempotency state retention and collision semantics;
- observable error/result for the losing duplicate/race path;
- tests create actual concurrency or deterministic interleaving where needed, not merely sequential calls.

Data duplication/loss or more than one logically successful side effect for an operation specified as idempotent is a material defect.
