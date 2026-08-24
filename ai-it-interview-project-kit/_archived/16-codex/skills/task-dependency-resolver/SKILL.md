# Skill: task-dependency-resolver

## Trigger

Use before implementing a backlog task or when a correction exposes a missing prerequisite.

## Objective

Determine whether the task can be executed safely from the current repository state.

## Checks

- explicit dependencies in backlog/roadmap/ExecPlan;
- schema/contract prerequisites;
- architecture/ADR prerequisites;
- decision gates;
- prior task behavior that must exist in the current branch ancestry;
- required test/evaluation infrastructure;
- environment prerequisites that can be verified locally.

## Verdicts

- `READY` — all required prerequisites are evidenced.
- `BLOCKED_BY_TASK` — a required prior outcome is absent.
- `BLOCKED_BY_BASELINE` — current repository cannot safely start the task.
- `DECISION_REQUIRED` — an unresolved product/architecture/provider/security gate must be decided.
- `UNKNOWN` — evidence is insufficient; request targeted verification.

## Rule

Do not implement speculative compatibility layers merely to bypass a missing dependency.

## Output

```text
DEPENDENCY_VERDICT:
required:
satisfied:
missing:
decision_gates:
evidence:
next_safe_action:
```
