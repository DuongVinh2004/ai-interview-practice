# Control Plane review template

Use this after Antigravity returns a handoff/diff. Review is independent and read-only.

```text
Review the Antigravity handoff and [patch/diff/branch evidence] against the official repository and Project Kit.

Apply:
- 16-codex/SUPERVISOR-PROTOCOL.md
- 16-codex/skills/scope-and-deviation-guard/SKILL.md
- 16-codex/skills/verification-and-test-guardian/SKILL.md
- task-specific review profiles selected for this task

Do not accept Antigravity's PASS at face value.

Check, in order:
1. repository/baseline/readiness evidence;
2. each acceptance criterion vs implementation and test evidence;
3. semantic deviation even if tests are green;
4. test integrity and negative cases;
5. diff scope/unrelated changes/dependencies;
6. applicable auth/security/ownership, concurrency, migration/contracts, AI, frontend/accessibility risks;
7. observability/rollback/degraded behavior where required;
8. residual risk and missing evidence.

Classify concrete findings as CRITICAL / HIGH / MEDIUM / LOW and separate validated defects from questions or optional improvements.

If a material defect exists, invoke the root-cause and convergence workflow before generating a correction. Never repeat a failed prompt unchanged.

Return:
SUPERVISOR_VERDICT: PASS | CHANGES_REQUIRED | BLOCKED | DECISION_REQUIRED
VALIDATED_FINDINGS:
MISSING_EVIDENCE:
ROOT_CAUSE_ACTION:
NEXT_PROMPT_MODE: CORRECT | VERIFY | COMMIT | NONE
```
