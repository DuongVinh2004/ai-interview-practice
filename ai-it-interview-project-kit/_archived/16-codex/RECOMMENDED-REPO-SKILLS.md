# Repository skills strategy

The project now includes a **Supervisor Skill Pack v1** under `16-codex/skills/`. These skills control the ChatGPT/Control-Plane-to-Antigravity loop and should be reused across project chats.

## Supervisor skills already defined

- `antigravity-supervisor`
- `execution-prompt-compiler`
- `repository-state-inspector`
- `task-dependency-resolver`
- `scope-and-deviation-guard`
- `root-cause-debugger`
- `corrective-prompt-engine`
- `loop-convergence-controller`
- `verification-and-test-guardian`
- `handoff-state-manager`

They are process/control skills and must not grant themselves authority to push, deploy, mutate cloud resources, access production data, or bypass decision gates.

## Future repository execution skills

Create a specialized execution skill only when a repeated workflow has stable repository commands and invariants. Candidate skills:

- `verify-auth-ownership-mfa` — focused refresh replay, cross-user ownership, session invalidation and admin MFA checks.
- `verify-interview-concurrency` — state transitions, idempotency, duplicate delivery and worker crash behavior.
- `run-ai-evals` — dataset/artifact hashes plus smoke/regression/adversarial eval comparisons.
- `check-contract-compatibility` — REST/SSE/event/provider schema and migration-phase compatibility.
- `assemble-release-evidence` — collect existing CI artifacts/digests into release evidence without inventing results.

Each future execution skill must define:

- narrow trigger;
- prerequisites;
- safe default permissions;
- exact commands discovered from the repository;
- redaction rules;
- stop conditions;
- expected compact output;
- which Supervisor review profile consumes its evidence.

Do not create or install skills merely because they sound useful. Split a review profile into a standalone skill only after repeated use proves that the workflow deserves independent lifecycle and commands.
