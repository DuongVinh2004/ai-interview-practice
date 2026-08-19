# ADR 0001: Modular Monolith Architecture

## Status

Accepted

## Context

The AI Interview Practice system requires a production-grade backend for candidate management, session progression, AI orchestration, answer evaluation, learning path generation, and administrative oversight. The engineering team consists of 4 developers working over a one-month MVP cycle.

Choosing a microservices architecture would introduce severe operational overhead, distributed transaction challenges, network latency, and complex local orchestration. Conversely, a monolithic architecture without strict boundaries would lead to high coupling, shared database access anti-patterns, and spaghetti dependencies.

## Decision

We adopt a **Modular Monolith** architecture implemented in NestJS with explicit module boundaries and encapsulated domain logic:

1. Business modules (`auth`, `profile`, `taxonomy`, `interview`, `ai-orchestrator`, `evaluation`, `learning-path`, `history-report`, `admin`) interact only via exported application services, ports, or domain events.
2. Direct cross-module database/repository imports are strictly forbidden.
3. Asynchronous workloads run via BullMQ queues and can execute either in-process or as isolated worker containers from the same codebase.

## Consequences

- **Positive**: Single deployable unit, straightforward local development via Docker Compose, zero network hops for internal domain queries, clean boundary encapsulation that can be split into microservices later if scaling demands it.
- **Negative**: Requires discipline to prevent accidental cross-boundary dependency leaks.
