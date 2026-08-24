# Skill: scope-and-deviation-guard

## Trigger

Use on every implementation/correction diff before approval.

## Objective

Detect both **scope creep** and **semantic deviation** even when tests are green.

## Compare

1. selected task outcome and acceptance criteria;
2. declared allowed scope;
3. actual changed files/contracts/schema/dependencies;
4. resulting product behavior;
5. tests that claim to prove the behavior.

## Scope severity

- `LOW` — small incidental change directly required by the task.
- `MEDIUM` — broader than declared but plausibly necessary; requires rationale.
- `HIGH` — unrelated module/refactor/dependency/contract change that materially expands review or risk.
- `CRITICAL` — unauthorized security/architecture/provider/destructive change.

## Semantic deviation examples

- old refresh token is rejected but token family is not revoked when requirement says family revoke;
- authorization test mocks away ownership middleware;
- API returns a new error shape without compatibility approval;
- AI score is accepted without rubric/evidence validation;
- task updates a test expectation to match broken behavior.

## Output

```text
SCOPE_VERDICT: PASS | REVIEW_REQUIRED | FAIL
changed_surface:
unexpected_changes:
semantic_deviations:
severity:
required_action:
```
