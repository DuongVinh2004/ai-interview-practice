# Antigravity task prompt template

Use `execution-prompt-compiler` and `16-codex/PROMPT-ENVELOPES.md` to instantiate this template. This prompt is for Antigravity execution; the Control Plane remains the final reviewer.

```text
MODE: EXECUTE
TASK: AIP-___ — [one observable outcome]
OFFICIAL_REPOSITORY: https://github.com/DuongVinh2004/ai-interview-practice.git
CONTROL_PLANE_VERDICT_REQUIRED: YES

AUTHORIZATION
- read: yes
- create_task_branch: yes
- edit: yes
- run_local_verification: yes
- local_commit: no
- push: no
- pr: no
- deploy: no
- cloud_mutation: no
- jira_write: no
- real_provider_calls: no

READ FIRST
- AGENTS.md
- 16-codex/SUPERVISOR-PROTOCOL.md
- [exact task-relevant Project Kit files only]

VERIFY BEFORE EDITING
- official origin
- current branch / HEAD / working tree
- task dependencies
- relevant existing code/tests
- repository-native verification scripts

REQUIRED OUTCOME
- [observable behavior]

ACCEPTANCE CRITERIA
- AC-01 ...
- AC-02 ...

INVARIANTS
- [task-specific invariants]
- do not weaken tests or acceptance criteria
- do not broaden scope to unrelated refactors
- do not cross any decision/authorization gate

REVIEW PROFILES
- [only applicable profiles from 16-codex/review-profiles/]

ALLOWED SCOPE
- [files/modules or bounded discovery rule]

FORBIDDEN
- unrelated changes
- test disabling/weakening
- invented PASS evidence
- destructive Git operations
- commit/push/PR/deploy/provider/cloud/Jira actions not authorized above

PROCESS
1. Preflight repository state and readiness.
2. Stop on conflict/dirty overlap/decision gate instead of guessing.
3. Implement the smallest coherent change.
4. Add/update meaningful positive and negative tests.
5. Run actual repository verification commands.
6. Self-repair direct implementation failures at most two cycles without weakening evidence.
7. Review the full diff for scope, secrets, compatibility, ownership and selected profiles.
8. Return the exact handoff in 16-codex/HANDOFF-TEMPLATE.md.

Do not commit. The Control Plane will independently review the handoff/diff and issue a separate CORRECT, VERIFY or COMMIT prompt.
```
