# Supervisor state management

## Purpose

Conversation memory is not authoritative project state. Persist only compact, auditable coordination state in `16-codex/state/` and re-verify it against the live repository before use.

## Files

- `CURRENT-STATE.yaml` — latest coordination checkpoint.
- `FAILURE-PATTERNS.yaml` — recurring Antigravity failure classes and guardrails learned from actual evidence.
- `TECHNICAL-DEBT.yaml` — explicitly deferred findings; not a dumping ground for failed acceptance criteria.

## CURRENT-STATE rules

Update only after a meaningful transition such as:

- baseline verified;
- execution handoff reviewed;
- correction reviewed;
- task becomes blocked;
- local commit created.

Never mark a task `PASS`, `READY_FOR_COMMIT`, or `COMMITTED_LOCAL` based solely on Antigravity prose. Store the Control Plane verdict separately.

If `CURRENT-STATE.yaml` conflicts with live Git evidence, live Git wins and the state file must be corrected.

## Failure pattern rules

Add a pattern only when:

- the behavior actually occurred;
- evidence exists in a handoff/diff/test;
- the pattern is likely to recur;
- a concrete future guard can be stated.

Do not profile Antigravity with subjective labels. Record deterministic failure classes and useful countermeasures.

## Technical debt rules

A finding may be deferred only when:

- it is not required for current acceptance criteria or a release/security gate;
- impact is understood;
- an owner or follow-up task is named;
- deferral does not create a critical/high security, data-loss, or correctness risk.

Critical/high defects cannot be relabeled as debt merely to finish a task.
