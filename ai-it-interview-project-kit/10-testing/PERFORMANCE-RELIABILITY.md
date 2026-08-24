# Performance and reliability test plan

## Workloads

Model browse/login, session creation, answer submission, SSE connection, background evaluation, report view, admin content publication, and export/deletion. Use realistic VI/EN payload distributions and provider latency/error injection.

## Stages

1. Establish single-instance capacity and query profile.
2. Load expected peak with 30% headroom.
3. Stress to identify saturation and graceful shedding.
4. Soak for at least eight hours to expose leaks and queue drift.
5. Spike and recovery test.
6. Fail an API replica, worker, Redis connection, database connection, and AI provider.

## Acceptance

Use the SLO/error-budget targets in `05-architecture/SCALABILITY-HA-SLO.md`. No data loss, duplicate completion, quota inconsistency, or unbounded backlog. Core persistence remains available during provider degradation. Recovery time and queue drain rate are recorded.

## Evidence

Store scenario, commit, infrastructure size, dataset, duration, arrival rate, latency distribution, errors, resource saturation, traces, database plans, queue age, cost, and conclusion. Do not compare results across materially different environments without labeling them.
