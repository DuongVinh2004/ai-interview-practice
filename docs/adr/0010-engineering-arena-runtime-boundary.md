# ADR 0010: Engineering Arena Modular-Monolith Placement and Sandbox Runtime Boundary

## Status

Accepted

## Context

AnyF provides simulated interviews and technical evaluations. Engineering Arena (Feature F017) introduces repository-scale problem solving (bug fixes, refactoring, feature enhancements) across multi-file codebases. Untrusted candidate-submitted code and challenge execution must be executed safely without exposing platform secrets, compromising server infrastructure, or causing performance degradation.

## Decision

1. **Modular Monolith Placement:** Engineering Arena orchestrator, metadata management, and evaluation APIs will reside inside `apps/api/src/modules/engineering-arena/` within the NestJS modular monolith, reusing existing database, Redis/BullMQ, telemetry, and authentication services.
2. **Execution Trust Boundary:** Workspace code execution is strictly decoupled from the core API process:
   - _Stage A (Local / CI / Unit Tests):_ Deterministic Mock Sandbox Adapter that executes isolated command mockups without external VM dependencies.
   - _Stage B (Development / Pilot):_ Ephemeral isolated containers (Docker) with non-root user, CPU/RAM quotas, read-only root filesystems, dropped network egress, and strict timeouts (15s).
   - _Stage C (Production):_ Remote firecracker/gVisor microVMs or dedicated Judge0 multi-file cluster.
3. **AI Authority Boundary:** AI models provide formative feedback and hint assistance, but objective test execution passes/fails dictate core evaluation gates. AI will never override failing automated tests.

## Consequences

- **Positive:** Reuses existing platform infrastructure without microservice operational complexity; ensures strong security boundary isolating host from untrusted execution.
- **Negative:** Requires strict container lifecycle cleanup logic to avoid disk/process leakage.
