# Skill: repository-state-inspector

## Trigger

Use at task start, chat resume, after unknown external changes, before commit, or whenever state is uncertain.

## Objective

Establish the live repository facts that downstream reasoning may rely on.

## Required evidence

At minimum discover/report:

- repository root;
- `origin` URL;
- current branch;
- HEAD SHA;
- working tree and untracked files;
- relevant base/merge-base when branch ancestry matters;
- recent relevant commits;
- actual build/test/lint/typecheck scripts/tooling;
- migrations/schema state when applicable;
- task-relevant files/tests already present.

## Rules

- Read-only by default.
- Never use chat memory as proof of branch/HEAD/dirty state.
- If origin is not the official repository or overlapping dirty work exists, return a blocker instead of normalizing it silently.
- Do not run destructive Git commands to make the repository look clean.

## Output

```text
REPO_STATE: VERIFIED | BLOCKED | INCONSISTENT
root:
origin:
branch:
head:
base_or_merge_base:
working_tree:
untracked:
relevant_scripts:
relevant_existing_implementation:
state_conflicts:
blockers:
```
