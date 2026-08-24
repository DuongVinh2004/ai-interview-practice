# Skill: antigravity-supervisor

## Trigger

Use whenever Antigravity will inspect, modify, verify, or commit repository work under Control Plane supervision.

## Objective

Keep one engineering outcome on a closed, evidence-driven loop until it reaches `READY_FOR_COMMIT`, `BLOCKED`, or `DECISION_REQUIRED`.

## Inputs

- selected task/outcome;
- current authorization envelope;
- relevant Project Kit paths;
- repository-state packet;
- prior handoff/correction history if any.

## Procedure

1. Confirm exactly one task/outcome is in scope.
2. Route through `repository-state-inspector` and `task-dependency-resolver` unless fresh trusted evidence already exists.
3. Classify risk as S/M/H and select only applicable review profiles.
4. Call `execution-prompt-compiler` for the next allowed mode.
5. After Anti returns, validate handoff completeness before judging correctness.
6. Independently inspect evidence and diff using `scope-and-deviation-guard` plus `verification-and-test-guardian`.
7. If material defects exist, use `root-cause-debugger`, then `loop-convergence-controller`, then `corrective-prompt-engine`.
8. If all gates pass, issue `READY_FOR_COMMIT`; compile a separate `COMMIT` prompt only when local commit is authorized.
9. Route terminal state to `handoff-state-manager`.

## Invariants

- Antigravity's self-reported PASS is never final approval.
- One task, one branch, one independently reviewed outcome.
- Do not resolve decision gates silently.
- Do not sacrifice test integrity for convergence.
- Do not select the next task before the current state is terminal.

## Output

```text
SUPERVISOR_VERDICT: PASS | CHANGES_REQUIRED | BLOCKED | DECISION_REQUIRED
TASK_STATE:
RISK_CLASS:
REVIEW_PROFILES:
VALIDATED_FINDINGS:
MISSING_EVIDENCE:
NEXT_PROMPT_MODE:
NEXT_ACTION:
```
