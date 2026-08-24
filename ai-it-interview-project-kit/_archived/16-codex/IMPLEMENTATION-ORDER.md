# Control Plane implementation order

## Per-chat bootstrap

1. Read root `AGENTS.md`, `16-codex/CHAT-BOOTSTRAP.md`, `16-codex/SUPERVISOR-PROTOCOL.md`, skill manifest, and `16-codex/state/CURRENT-STATE.yaml`.
2. Treat the state file as a checkpoint only; re-verify the official repository branch/HEAD/working tree before relying on it.

## Per-task loop

1. Select exactly one issue/outcome from `11-delivery/jira-backlog.csv` or the current approved task.
2. Run `repository-state-inspector` and `task-dependency-resolver` using live repository evidence.
3. Read only the relevant domain/requirements/architecture/data/contracts/security/tests/runbooks plus linked source/tests.
4. Classify task risk S/M/H and select only applicable review profiles.
5. For cross-cutting or high-risk work, create/update an ExecPlan before product-code changes.
6. Use `execution-prompt-compiler` to issue `MODE: EXECUTE`; Antigravity performs bounded local inspect/edit/test/self-review and returns the standard handoff without committing by default.
7. The Control Plane independently applies `scope-and-deviation-guard` and `verification-and-test-guardian` to the handoff/diff.
8. If evidence is missing but no defect is proven, issue `MODE: VERIFY` rather than speculative edits.
9. If a defect is validated, run `root-cause-debugger` -> `loop-convergence-controller` -> `corrective-prompt-engine`, then issue a progressively constrained `MODE: CORRECT` prompt. Never repeat a failed prompt unchanged.
10. Stop according to `STOP-CONDITIONS.md` if the loop does not converge, a decision gate appears, or safe verification is impossible.
11. Mark `READY_FOR_COMMIT` only after every applicable acceptance, verification, scope, test-integrity, security/privacy/ownership and task-specific profile gate passes.
12. When local commit is explicitly authorized, issue a separate `MODE: COMMIT` prompt: stage exact reviewed paths, inspect staged diff, commit locally, return SHA/status. Never push implicitly.
13. `handoff-state-manager` updates `16-codex/state/CURRENT-STATE.yaml` after Supervisor review and records legitimate recurring failure patterns/debt only when evidenced.
14. Select the next task only after the current task reaches a terminal state.

## Program priority

Priority order is **M0 -> M1 -> provider gate/M2 -> M3 -> M4 -> M5**.

Do not connect a production AI provider before the evaluation harness and privacy/security gates exist. Do not implement voice, payments, organization tenancy, or hiring decisions without newly approved scope and decision records.
