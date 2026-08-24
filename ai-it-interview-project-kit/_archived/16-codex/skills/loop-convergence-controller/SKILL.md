# Skill: loop-convergence-controller

## Trigger

Use after any correction attempt or when the same failure class reappears.

## Objective

Ensure correction loops become progressively more informative and constrained, then stop safely if they do not converge.

## State tracked

- attempt number;
- defect IDs;
- failure classes;
- what changed between attempts;
- whether evidence improved;
- whether new material defects were introduced;
- current escalation level.

## Rules

- Never resend the same prompt unchanged.
- Escalate from Autonomous -> Guided -> Constrained -> Prescriptive only as justified by evidence.
- Use `VERIFY` when uncertainty, not implementation freedom, is the blocker.
- Stop after three bounded correction attempts for the same material defect unless new evidence materially changes the diagnosis.
- Immediately stop for destructive/security/privacy/decision-gate conditions in `STOP-CONDITIONS.md`.

## Output

```text
CONVERGENCE: IMPROVING | STALLED | REGRESSING | CONVERGED | STOP
attempt:
escalation_level:
repeated_failure_classes:
new_evidence:
next_mode:
constraint_changes:
stop_reason:
```
