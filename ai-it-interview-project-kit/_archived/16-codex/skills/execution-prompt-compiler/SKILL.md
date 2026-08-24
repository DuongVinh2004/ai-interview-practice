# Skill: execution-prompt-compiler

## Trigger

Use whenever the Control Plane needs to instruct Antigravity.

## Objective

Compile a high-signal prompt that references local sources, grants only required authority, and produces evidence that can be independently reviewed.

## Inputs

- prompt mode: `EXECUTE`, `CORRECT`, `VERIFY`, or `COMMIT`;
- task ID/outcome;
- repository-state packet;
- dependency verdict;
- risk class and review profiles;
- validated defects for correction mode;
- current authorization.

## Context selection

Load/reference:

1. `AGENTS.md` and supervisor protocol;
2. exact relevant Project Kit requirement/contract/security/test docs;
3. linked implementation/tests or a narrow discovery instruction;
4. current ExecPlan only when applicable.

Do not paste unrelated Project Kit sections into the prompt.

## Prompt quality gates

The compiled prompt must make these unambiguous:

- observable outcome;
- acceptance criteria;
- invariants;
- allowed scope;
- forbidden actions;
- verification evidence required;
- stop conditions;
- handoff format.

For correction mode, include evidence-backed defect IDs and stronger constraints than the prior run.

## Output

A single copy-ready Antigravity prompt conforming to `16-codex/PROMPT-ENVELOPES.md`.
