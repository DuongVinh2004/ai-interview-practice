# Definition of Ready and Done

## Ready

A task is ready when its outcome, owner, dependencies, user/risk context, acceptance criteria, affected contracts/data, privacy/security implications, tests, observability, rollout, rollback, and documentation updates are known. Unknown high-impact choices are explicit decision gates, not hidden assumptions.

## Done for code

- Acceptance criteria demonstrably pass.
- Code follows module boundaries and contains no unrelated refactor.
- Required unit/integration/contract/E2E/security/AI tests pass.
- Migration is backward compatible and rehearsed when applicable.
- Authorization, privacy, accessibility, localization, logging, metrics, traces, cost, failure handling, and idempotency are addressed.
- Docs/contracts/runbooks/evidence are updated.
- Independent review is complete and no blocking findings remain.

## Done for release

Immutable artifact is built once and promoted; environment config/secret checks pass; canary and rollback are tested; dashboards/alerts/on-call are ready; backup/restore status is current; known risks have owners/expiry; product, engineering, security/privacy, content/AI quality, and operations sign off as applicable.

“Works on my machine,” a screenshot, percentage coverage alone, or AI prose quality by anecdote is not Done.
