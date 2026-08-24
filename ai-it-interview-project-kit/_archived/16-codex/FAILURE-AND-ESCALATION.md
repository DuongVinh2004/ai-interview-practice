# Failure diagnosis and convergence

## Goal

Corrections must converge toward the required behavior. Repeating the same vague prompt after a failed Antigravity run is prohibited.

## Failure classes

Classify the primary failure before generating a correction:

- `SPEC_MISUNDERSTANDING` — implementation reflects the wrong product behavior.
- `SCOPE_DRIFT` — unrelated changes or refactors exceed the task.
- `IMPLEMENTATION_BUG` — intended design is sound but code is incorrect.
- `TEST_DEFECT` — the test itself does not encode the approved behavior.
- `TEST_WEAKENING` — tests were changed to accommodate broken behavior.
- `ENVIRONMENT` — local tool/service/runtime prevents valid verification.
- `DEPENDENCY` — prerequisite task/schema/contract is absent or incompatible.
- `DATA_MIGRATION` — data shape/backfill/index/rollback path is unsafe.
- `CONCURRENCY` — race, duplicate delivery, retry, idempotency, or transaction issue.
- `SECURITY_AUTHZ` — authn/authz/ownership/MFA/session/security invariant is broken.
- `CONTRACT_COMPATIBILITY` — REST/event/SSE/provider schema change breaks compatibility.
- `AI_AUTHORITY` — AI output is trusted beyond rubric/evidence/versioned boundary.
- `ARCHITECTURE` — current task cannot be corrected safely without an approved structural decision.
- `TOOLING` — build/test/lint/configuration mechanics are wrong.
- `UNKNOWN` — evidence is insufficient; use `VERIFY` before prescribing a fix.

## Correction escalation levels

### Level 0 — Autonomous

Use on the first well-scoped execution.

Provide outcome, acceptance criteria, constraints, and verification.

### Level 1 — Guided

Use after one validated miss.

Add:

- exact failed acceptance criterion;
- concrete evidence;
- root-cause hypothesis;
- affected subsystem;
- required regression proof.

### Level 2 — Constrained

Use when the same defect class repeats or the first correction still drifts.

Add:

- explicit allowed files/modules or very narrow discovery rule;
- explicit forbidden files/behaviors;
- required algorithmic invariant;
- exact negative tests;
- exact re-verification commands.

### Level 3 — Prescriptive

Use only when the intended solution is sufficiently understood and repeated autonomous attempts are non-convergent.

Add:

- ordered behavioral steps;
- exact state transitions/data invariants;
- exact transaction/locking/idempotency expectations where relevant;
- exact acceptance matrix;
- instruction to stop if repository facts contradict the prescription.

Do not force a patch that conflicts with live code evidence.

### Level 4 — Stop / redesign

Stop automated correction when any condition applies:

- three bounded correction attempts fail to resolve the same material defect;
- each attempt creates a new critical/high defect class;
- fixing the task safely requires an unresolved architecture/provider/security decision;
- live repository evidence contradicts the planned solution;
- a destructive migration/security/privacy boundary requires authorization;
- verification cannot establish correctness with available tooling;
- Antigravity repeatedly weakens tests or bypasses controls.

Return a diagnostic packet instead of continuing the loop.

## Diagnostic packet

```text
TASK:
ATTEMPTS:
PRIMARY_FAILURE_CLASS:
VALIDATED_FACTS:
UNRESOLVED_UNKNOWN:
LAST_GOOD_BASELINE:
MATERIAL_DIFF:
TEST/EVIDENCE:
WHY_PRIOR_CORRECTIONS_DID_NOT_CONVERGE:
DECISION_OR_DESIGN_CHANGE_REQUIRED:
SAFE_OPTIONS:
```

## No symptom-fixing rule

Do not correct an observed failure until the expected behavior is anchored to a requirement/contract/invariant.

Example:

- Symptom: endpoint returns `401`, test expects `200`.
- Invalid correction: change the test to `401` because current code does so.
- Required workflow: determine the approved behavior, inspect authorization/session state, identify the causal mismatch, fix code or test according to the approved behavior, then add regression evidence.
