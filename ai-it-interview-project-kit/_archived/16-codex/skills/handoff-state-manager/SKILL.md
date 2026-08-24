# Skill: handoff-state-manager

## Trigger

Use at the end of every Anti run, after Supervisor review, after local commit, and before moving to a new chat.

## Objective

Keep compact, reproducible continuity without relying on conversation memory.

## Procedure

1. Normalize Anti output into `16-codex/HANDOFF-TEMPLATE.md`.
2. Separate Anti's self-verdict from the Supervisor verdict.
3. Record branch/HEAD/working-tree facts and exact changed paths.
4. Record acceptance/verification evidence and unresolved findings.
5. Update `16-codex/state/CURRENT-STATE.yaml` only after Supervisor review.
6. Add recurring evidenced failure patterns only when they satisfy `STATE-MANAGEMENT.md`.
7. Add deferred debt only when it is legitimate non-blocking debt.
8. Name exactly one next safe action; do not silently choose a future task when current work is non-terminal.

## Output

A compact handoff plus state update proposal. Live repository readback is required before treating the checkpoint as current in a future chat.
