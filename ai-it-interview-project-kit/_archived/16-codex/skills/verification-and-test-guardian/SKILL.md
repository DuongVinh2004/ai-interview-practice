# Skill: verification-and-test-guardian

## Trigger

Use before a Control Plane PASS, before commit, and after any correction affecting behavior.

## Objective

Prove the task outcome with repository-native commands and task-specific negative evidence while preserving test integrity.

## Core checks

1. Map every acceptance criterion to evidence.
2. Discover verification commands from repository configuration/CI; do not invent scripts.
3. Require affected unit/integration/E2E/build/lint/type checks as appropriate.
4. Inspect changed tests for weakening, disabling, over-mocking, broad exception swallowing, or expectation drift.
5. Load only applicable review profiles from `16-codex/review-profiles/`.
6. Distinguish `PASS`, `FAIL`, and `NOT_RUN`; never convert missing execution into PASS.
7. Record the smallest useful failure excerpt, not entire logs.

## Test integrity invariant

A test change is valid only when it improves evidence for an approved behavior, adapts to an approved contract change, or corrects a demonstrably faulty test. The implementation may not redefine expected behavior merely to pass.

## Output

```text
VERIFICATION_VERDICT: PASS | FAIL | INCOMPLETE
acceptance_matrix:
commands:
negative_cases:
test_integrity:
profile_findings:
missing_evidence:
```
