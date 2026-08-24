# Antigravity prompt envelopes

All prompts compiled for Antigravity should use one of these four modes. Keep prompts task-specific; reference local Project Kit paths instead of copying whole documents into the prompt.

## Common header

Every prompt starts with:

```text
MODE: EXECUTE | CORRECT | VERIFY | COMMIT
TASK: AIP-___ — <one observable outcome>
OFFICIAL_REPOSITORY: https://github.com/DuongVinh2004/ai-interview-practice.git
CONTROL_PLANE_VERDICT_REQUIRED: YES

AUTHORIZATION
- read: yes
- create_task_branch: <yes/no>
- edit: <yes/no>
- run_local_verification: <yes/no>
- local_commit: <yes/no>
- push: no unless explicitly authorized
- pr: no unless explicitly authorized
- deploy: no unless explicitly authorized
- cloud_mutation: no unless explicitly authorized
- jira_write: no unless explicitly authorized
- real_provider_calls: no unless explicitly authorized
```

The prompt must also name:

- exact Project Kit documents to read;
- exact task dependencies to verify;
- relevant code/tests to inspect or discovery rules;
- required observable behavior;
- acceptance criteria;
- invariants;
- applicable review profiles;
- allowed/prohibited change scope;
- required verification;
- stop conditions;
- required handoff format.

## EXECUTE

Use for the first bounded implementation attempt.

Required process:

```text
1. Preflight repository state.
2. Verify task readiness and current implementation gap.
3. Create/use exactly one task branch when allowed.
4. Implement the smallest coherent change.
5. Add or update meaningful acceptance/negative tests.
6. Run repository-native verification commands.
7. Use at most two self-repair cycles for direct implementation failures.
8. Review full diff for scope, secrets, compatibility, ownership, and selected risk profiles.
9. Return handoff. Do not commit unless explicitly authorized in this prompt.
```

## CORRECT

Use only after the Control Plane validates one or more defects.

A corrective prompt must contain:

```text
VALIDATED_DEFECTS
- ID / severity / observed evidence

ROOT_CAUSE_HYPOTHESIS
- <specific causal mechanism, or "not yet proven">

REQUIRED_BEHAVIOR
- <what must be true after correction>

REGRESSION_PROOF
- <test or evidence that would have failed before the fix>

ALLOWED_SCOPE
- <specific modules/files or bounded discovery rule>

FORBIDDEN
- do not weaken tests
- do not change acceptance criteria
- do not broaden architecture
- do not hide errors
- do not modify unrelated files

REVERIFY
- <exact commands / scenarios>
```

A correction must be **more constrained** than the failed attempt. Never resend the same prompt unchanged.

## VERIFY

Use for read-only or test-only independent evidence.

Typical purposes:

- verify a security or ownership invariant;
- reproduce a race condition;
- validate a migration sequence;
- inspect contract compatibility;
- confirm the final diff after correction;
- obtain evidence that was missing from a prior handoff.

Default authorization is read-only plus local tests. No product-code edit unless explicitly changed to `CORRECT`.

## COMMIT

Use only after the Control Plane has issued `READY_FOR_COMMIT`.

Required sequence:

```text
1. Re-check branch and working tree.
2. Confirm no unrelated changes were introduced since review.
3. Stage only the exact reviewed paths; never use `git add .`.
4. Show `git diff --cached --stat` and `git diff --cached --name-only`.
5. Inspect the staged diff for unexpected content/secrets.
6. Create one local commit with the approved message.
7. Return commit SHA and `git status --short --branch`.
8. Do not push, PR, merge, deploy, or write Jira.
```
