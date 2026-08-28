# AnyF Engineering Arena — Repository Readiness Report (ARENA-001)

**Generated:** 2026-08-28  
**Live Commit SHA:** `553080bd952041a29251d73b1a9591acf559dede`  
**Official Remote:** `https://github.com/DuongVinh2004/ai-interview-practice.git`  
**Branch:** `main`  
**Risk Class:** S  

---

## 1. Readiness Matrix

| Capability | Live Files | Verified Behavior | Reuse / Extend / Missing | Risk | Notes |
|---|---|---|---|---|---|
| **Code Execution Core** | `apps/api/src/modules/code-execution/` | Single-file source execution via Judge0 and MockSandboxProvider | **EXTEND** | M | Existing system only handles single files. Arena requires multi-file repository workspace execution. |
| **Monaco Code UI** | `apps/web/src/components/code-editor/` | MonacoCodeEditor with basic test runner and console output | **EXTEND** | M | Needs file tree navigator, diff viewer, multi-tab buffer, terminal emulator. |
| **Data Persistence** | `apps/api/prisma/schema.prisma` | Single-file `CodeSubmission`, `CodeExecutionResult` models | **EXTEND** | M | Add `EngineeringChallenge`, `ArenaSession`, `ArenaExecutionRun`, `ArenaSubmission`, `ArenaEvaluation`, `ArenaSkillEvidence`. |
| **Contracts / DTOs** | `packages/contracts/src/schemas/` | Zod schemas for code-execution, evaluation, skill-graph | **EXTEND** | S | Create `packages/contracts/src/schemas/engineering-arena.ts` exporting Zod types. |
| **Skill Graph Engine** | `apps/api/src/modules/skill-graph/` | Skill score calculation, taxonomy mapping, mastery tracking | **REUSE** | S | Map `ArenaSkillEvidence` to existing competency nodes. |
| **AI Evaluation Engine** | `apps/api/src/modules/evaluation/`, `ai-orchestrator/` | Prompt versioning, structured rubric evaluation, AI run tracking | **REUSE** | S | Leverage `PromptVersion` and `AiOrchestratorService` for Arena rubric scoring. |
| **Queues / BullMQ** | `apps/api/src/modules/platform/` (Redis/BullMQ) | Async background jobs, retry with backoff, DLQ | **REUSE** | S | Reuse BullMQ queue configuration for `arena-execution` and `arena-evaluation`. |
| **Auth & Ownership** | `apps/api/src/modules/auth/`, guards | JWT, MFA step-up, RBAC, User resource ownership guards | **REUSE** | S | Secure `/arena/*` endpoints with standard user ownership guards. |
| **Observability** | `apps/api/src/modules/platform/metrics/` | Prometheus exporter, OpenTelemetry spans | **REUSE** | S | Register Arena execution duration and submission counters. |
| **Challenge Manifest Engine**| *None* | No manifest loader, validation engine, or tarball unbundler | **MISSING** | H | To be built in Phase P2 (`apps/api/src/modules/engineering-arena/manifest/`). |
| **Workspace Runtime Sandbox**| *None* | No isolated multi-file ephemeral container runner | **MISSING** | H | To be built in Phase P3 (`apps/api/src/modules/engineering-arena/runtime/`). |

---

## 2. Smallest Safe Implementation Path

1. **P0:** Record ADR (`0010-engineering-arena-runtime-boundary.md`) and Threat Model (`ARENA-THREAT-MODEL.md`).
2. **P1:** Add Zod contracts (`engineering-arena.ts`), Prisma schema models & migration, and API domain module.
3. **P2:** Build Challenge Manifest Parser and Validator.
4. **P3:** Implement Workspace Runner (Stage A: Mock/Deterministic Local Sandbox, Stage B: Docker Runner).
5. **P4:** Build Evidence Extractor and Rubric Scorer.
6. **P5:** Web Arena Candidate IDE and Feedback Report.
7. **P6:** Skill Graph Sync.
8. **P7:** Add initial 5 high-quality challenge packs.
9. **P8-P10:** Hardening, AI Pair Assistant, E2E verification and launch.

---

## 3. Discrepancy & Baseline Check

- Current repository builds cleanly across `@anyf/contracts`, `@anyf/api`, and `@anyf/web`.
- No breaking conflicts detected with existing F001-F016 modules.
- Verification Status: **PASS (Read-only audit complete)**.
