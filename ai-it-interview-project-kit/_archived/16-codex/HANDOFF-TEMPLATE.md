# Antigravity execution handoff template

Every `EXECUTE`, `CORRECT`, or material `VERIFY` run must end with this compact packet. Antigravity's verdict is a self-verdict only; the Control Plane reviews it independently.

```text
=== AIP EXECUTION HANDOFF ===

TASK
id: AIP-___
title: <one observable outcome>
mode: EXECUTE | CORRECT | VERIFY
anti_verdict: PASS | FAIL | BLOCKED

BASELINE
repository_root:
origin:
branch:
base_sha:
head_sha:
working_tree_before:

READINESS
dependency_verdict:
decision_gates:

SCOPE
changed_files:
untracked_files:
dependencies_changed:
schema_or_contract_changed:
unexpected_scope:

IMPLEMENTATION
- <concise implementation decision + resulting behavior>

ACCEPTANCE MATRIX
- AC-01: PASS | FAIL | NOT_RUN — <evidence>
- AC-02: PASS | FAIL | NOT_RUN — <evidence>

VERIFICATION
- <command/scenario>: PASS | FAIL | NOT_RUN — <exit/result + short evidence>

TEST INTEGRITY
status: PASS | FAIL
changed_tests:
justification:
bypasses_detected:

SECURITY / PRIVACY / OWNERSHIP
status: PASS | FAIL | NOT_APPLICABLE | NOT_RUN
findings:

TASK-SPECIFIC PROFILES
- <profile>: PASS | FAIL | NOT_APPLICABLE — <evidence/findings>

DIFF SUMMARY
git_diff_check:
git_diff_stat:
git_diff_name_only:
patch_or_full_diff_path:

RISKS
- <residual risk, or none>

BLOCKERS
- <exact blocker + evidence, or none>

WORKTREE AFTER
branch:
head_sha:
status_short_branch:

RECOMMENDED NEXT ACTION
<return for supervisor review | targeted verify | correction needed | ready for commit review>

=== END HANDOFF ===
```

## Evidence compression

Do not paste full build/test logs when a concise result is enough.

For PASS include command, exit/result, test count or artifact if useful.

For FAIL include the smallest relevant failure excerpt, file/test/scenario, expected vs observed, and exit code when available.

## Optional machine-readable form

A JSON representation may follow `16-codex/schemas/handoff.schema.json`, but the human-readable packet above remains acceptable.
