# Skill: corrective-prompt-engine

## Trigger

Use after one or more defects have been validated and root-cause analysis is sufficient to act.

## Objective

Produce a correction prompt that is narrower, more explicit, and harder to game than the failed prompt.

## Inputs

- validated defect packet(s);
- current escalation level;
- allowed scope;
- required regression proof;
- applicable review profiles;
- previous failed behavior.

## Construction rules

- Name the defect and evidence; do not say only "fix it".
- State required behavior, not just desired code shape.
- Constrain files/modules when useful.
- Explicitly forbid test weakening and unrelated refactors.
- Require a regression test/evidence that would fail before the fix.
- Re-run the smallest sufficient verification set plus affected full gates.
- If live facts contradict the root-cause hypothesis, instruct Anti to stop and report rather than improvise.

## Output

A copy-ready `MODE: CORRECT` prompt using `16-codex/PROMPT-ENVELOPES.md`.
