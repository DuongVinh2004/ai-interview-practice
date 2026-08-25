# Antigravity Supervisor Protocol

## Purpose

This protocol defines the reusable control loop for developing the AI IT Interview project with a **Control Plane** and **Antigravity as a local executor**.

The Control Plane owns reasoning, task selection, decomposition, risk classification, prompt construction, review, diagnosis, correction, and authorization gates. Antigravity owns bounded local execution: inspection, task-scoped edits, local verification, diff collection, and evidence reporting.

The protocol exists to optimize both **correctness** and **throughput**. Antigravity must not become the source of truth for requirements, architecture, completion state, or task sequencing.

## Source-of-truth hierarchy

When sources disagree, use this order and stop on unresolved contradictions:

1. Explicit current user authorization and current approved decision gates.
2. Live official repository state for what exists now.
3. Approved ADRs and `00-start-here/DECISION-REGISTER.md`.
4. Project Kit requirements, contracts, security, testing, delivery, and operations documents.
5. Current ExecPlan for the task, if one exists.
6. Current task prompt.
7. Antigravity's own assumptions.

Antigravity must never silently override a higher source with a lower one.

## Roles

### Control Plane

The Control Plane is responsible for:

- selecting one ready engineering outcome;
- verifying task dependencies and decision gates;
- choosing a risk class and review profiles;
- selecting only the context required for the task;
- compiling an `EXECUTE`, `CORRECT`, `VERIFY`, or `COMMIT` prompt;
- independently reviewing Antigravity evidence and diff;
- diagnosing root cause when a run fails or deviates;
- escalating correction constraints when the loop does not converge;
- deciding `PASS`, `CHANGES_REQUIRED`, `BLOCKED`, or `DECISION_REQUIRED`;
- authorizing a local commit only after evidence gates pass;
- selecting the next task only after the current task reaches a terminal state.

### Antigravity

Antigravity is responsible for:

- reading the exact local sources named by the Control Plane;
- re-verifying repository state instead of trusting chat memory;
- making only task-scoped changes;
- writing or updating meaningful tests without weakening expected behavior;
- running actual repository commands discovered from repository configuration;
- performing a bounded self-repair loop for direct implementation mistakes;
- reviewing its own diff for scope, secrets, compatibility, and risk;
- returning a compact evidence handoff;
- stopping on explicit stop conditions instead of guessing.

Antigravity must not:

- choose the next backlog item;
- resolve an architecture/provider/security decision gate by itself;
- broaden scope merely to make implementation easier;
- weaken tests or requirements to make a run green;
- claim completion without reproducible evidence;
- commit, push, open a PR, merge, deploy, mutate cloud resources, call a paid/real provider, or write Jira unless that action was separately authorized.

## Default authorization envelope

Unless a current prompt says otherwise:

| Action                                                       |           Default |
| ------------------------------------------------------------ | ----------------: |
| Read local repository and Project Kit                        |             ALLOW |
| `git status`, `diff`, `log`, `show`, `branch --show-current` |             ALLOW |
| Create one short-lived task branch                           |             ALLOW |
| Edit task-scoped files                                       |             ALLOW |
| Add/update task-scoped tests                                 |             ALLOW |
| Run local lint/typecheck/test/build                          |             ALLOW |
| Use synthetic/local fixtures and local databases             |             ALLOW |
| Update task evidence/state files                             |             ALLOW |
| Local commit                                                 |              GATE |
| Push / PR / merge / rebase / reset / stash                   | GATE or FORBIDDEN |
| Jira write                                                   |              GATE |
| Deploy / cloud mutation                                      |              GATE |
| Real AI/voice/payment provider call                          |              GATE |
| Destructive migration                                        |              GATE |
| Access production data or secrets                            |              GATE |

A prompt may narrow permissions, but must not silently broaden them.

## Task risk classes

The Control Plane classifies each task before compilation.

### S — Scoped

Typical examples: documentation alignment, a narrow validator, a small endpoint behavior, focused tests.

Default flow:

`EXECUTE -> REVIEW -> COMMIT`

### M — Cross-module

Typical examples: session lifecycle, queue behavior, evaluation pipeline, cross-module ownership.

Default flow:

`PLAN if needed -> EXECUTE -> REVIEW -> targeted VERIFY -> COMMIT`

### H — High risk

Typical examples: authentication, MFA, authorization, destructive or compatibility-sensitive migrations, concurrency/idempotency, AI scoring authority, real provider integration, IaC, release/security controls.

Default flow:

`PLAN -> DECISION GATE if needed -> EXECUTE -> adversarial REVIEW -> VERIFY -> COMMIT`

## Closed-loop state machine

Every task follows this state machine:

```text
UNASSESSED
    |
    v
READY -----> DECISION_REQUIRED
    |
    v
EXECUTING
    |
    +-----> BLOCKED
    |
    v
REVIEWING
    |
    +-----> CHANGES_REQUIRED
    |             |
    |             v
    |         CORRECTING
    |             |
    |             +------> BLOCKED
    |             |
    |             v
    |         REVERIFYING
    |             |
    +-------------+
    |
    v
READY_FOR_COMMIT
    |
    v
COMMITTED_LOCAL
```

A task may not jump from `EXECUTING` to `COMMITTED_LOCAL` without independent review.

## Prompt types

Only four execution prompt types are required for normal work:

1. `EXECUTE` — bounded implementation plus verification, no commit by default.
2. `CORRECT` — fix validated defects only, with stronger constraints than the failed run.
3. `VERIFY` — read-only or test-only validation of a claim or high-risk behavior.
4. `COMMIT` — stage exact reviewed paths, inspect staged diff, and create one local commit when authorized.

Use `16-codex/PROMPT-ENVELOPES.md` for required fields.

## Anti self-repair budget

During one `EXECUTE` or `CORRECT` run, Antigravity may repair direct implementation failures without returning to the Control Plane when all of these are true:

- the failure is caused by the current task changes;
- the intended behavior is already unambiguous;
- the repair remains inside allowed scope;
- no decision gate is introduced;
- tests and acceptance criteria are not weakened.

Default budget: **two local repair cycles**.

After the budget is exhausted, return `FAIL` or `BLOCKED` with the smallest useful diagnostic packet.

## Independent review rule

Antigravity self-review is evidence, not approval.

The Control Plane must independently compare:

- task requirement;
- relevant contracts and invariants;
- implementation behavior;
- test behavior;
- diff scope;
- verification evidence;
- residual risk.

A green test suite is necessary evidence but is never, by itself, sufficient proof that the task is complete.

## Completion gate

A task is `READY_FOR_COMMIT` only when all applicable gates pass:

- repository baseline and branch are valid;
- declared dependencies are satisfied;
- acceptance criteria are all evidenced;
- required verification commands pass;
- test integrity passes;
- scope/deviation review passes;
- applicable security/privacy/ownership review passes;
- applicable migration/compatibility/concurrency/AI review passes;
- no unresolved critical/high finding remains;
- no decision gate is being bypassed;
- the final diff is reviewed;
- residual risk is documented.

## Non-negotiable anti-patterns

Reject or correct any run that uses these tactics to obtain a green result:

- `.skip`, `.only`, `todo`, disabled suites, or deleted meaningful tests without approved behavior change;
- removing or weakening assertions to match broken implementation;
- arbitrary timeout increases without root-cause evidence;
- mocking away the behavior the integration test is meant to verify;
- catching and ignoring errors that should fail;
- disabling lint/type/security rules without an approved reason;
- `--force`, `--no-verify`, broad ignore rules, or equivalent bypasses;
- changing acceptance criteria inside implementation code or tests;
- broad refactors unrelated to the task;
- replacing a failed external/security gate with an invented PASS claim.

## Handoff contract

Every execution run must end with the compact handoff defined in `16-codex/HANDOFF-TEMPLATE.md`.

The handoff must distinguish:

- observed fact;
- implementation decision;
- verification evidence;
- unresolved risk;
- blocker;
- recommended next action.

Do not include hidden chain-of-thought. Provide concise rationale and reproducible evidence.

## Chat continuity

New chats must not depend on long conversation history. Start with:

1. `16-codex/CHAT-BOOTSTRAP.md`;
2. `16-codex/state/CURRENT-STATE.yaml`;
3. the latest task handoff or patch, if any;
4. live repository verification through Antigravity before implementation.

The live repository remains authoritative if the state file is stale.
