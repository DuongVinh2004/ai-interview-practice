# Supervisor Skill Pack v1 — Change summary

## Added

- Closed-loop Control Plane ↔ Antigravity protocol.
- Four execution modes: `EXECUTE`, `CORRECT`, `VERIFY`, `COMMIT`.
- Ten core supervisor skills under `16-codex/skills/`.
- Risk-aware review profiles for auth/security, concurrency/idempotency, migration/contracts, AI evaluation, and frontend/accessibility.
- Progressive correction escalation with bounded self-repair and non-convergence stop conditions.
- Test-integrity rules that reject test weakening and control bypasses.
- Compact evidence handoff and optional JSON schema.
- Persistent coordination state, failure-pattern library, and technical-debt register.
- Project chat bootstrap and reusable project-instruction text.
- Skill manifest for lightweight routing.

## Updated

- `README.md`
- `AGENTS.md`
- `00-start-here/CODEX-OPERATING-MODE.md`
- `16-codex/TASK-PROMPT-TEMPLATE.md`
- `16-codex/HANDOFF-TEMPLATE.md`
- `16-codex/REVIEW-PROMPT-TEMPLATE.md`
- `16-codex/RECOMMENDED-REPO-SKILLS.md`

## Operating decision

Antigravity is explicitly treated as an executor, not an authority. Task sequencing, review verdict, correction strategy, convergence, and commit authorization remain with the Control Plane.
