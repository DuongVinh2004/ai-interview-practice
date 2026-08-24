# Test strategy

Testing follows the risk pyramid: many deterministic unit tests, service-level integration tests against real PostgreSQL/Redis, contract tests at boundaries, focused browser E2E tests, and separate AI evaluations. Mocks do not prove database constraints, queue behavior, or provider compatibility.

## Layers

| Layer | Primary purpose | Required environment |
|---|---|---|
| Unit | pure domain rules, schemas, score calculation, state transitions | process only |
| Integration | repositories, auth/session, migrations, queues, idempotency | PostgreSQL + Redis |
| Contract | REST/SSE/events/provider schemas and compatibility | producer/consumer fixtures |
| E2E | critical candidate/admin journeys and accessibility | production-like stack |
| Performance | latency, saturation, backpressure, failover | isolated load environment |
| Security | negative authorization, abuse cases, scanning | CI + staging |
| AI eval | quality, evidence, safety, slice regression | pinned datasets/artifacts |

## Principles

Tests are isolated, parallel-safe, deterministic unless explicitly statistical, and produce useful failure evidence without secrets. Flaky tests are defects: quarantine is time-bounded with an owner. Test data is synthetic. Every escaped production defect adds the lowest-cost effective regression test.
