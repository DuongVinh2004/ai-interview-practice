# Skill: root-cause-debugger

## Trigger

Use when Anti returns FAIL/BLOCKED, when independent review finds a defect, or when evidence contradicts a claimed PASS.

## Objective

Identify the causal failure class before prescribing a correction.

## Method

1. Anchor expected behavior to Project Kit/task evidence.
2. Reproduce or inspect the observed mismatch.
3. Separate symptom from cause.
4. Classify using `16-codex/FAILURE-AND-ESCALATION.md`.
5. Identify the smallest causal boundary that explains the failure.
6. State what evidence would falsify the root-cause hypothesis.
7. Do not prescribe a code change when the expected behavior or cause is still unknown; request `VERIFY` instead.

## Output

```text
DEFECT_ID:
SEVERITY:
FAILURE_CLASS:
EXPECTED:
OBSERVED:
EVIDENCE:
ROOT_CAUSE_HYPOTHESIS:
CONFIDENCE: high | medium | low
FALSIFYING_EVIDENCE:
REQUIRED_BEHAVIOR_AFTER_FIX:
REGRESSION_PROOF:
```
