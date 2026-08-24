# Coverage and quality gates

Line coverage is diagnostic; risk coverage is the release gate.

## Initial thresholds

- Changed-line coverage: at least 85% for application code.
- Global line/branch coverage: establish baseline in M0, then prevent regression; target at least 80% line and 70% branch by production launch.
- 100% named-path coverage for score calculation, interview state transitions, ownership checks, refresh rotation/reuse, MFA enforcement, quota charging, and queue idempotency.
- Every public API change has schema/contract tests; every migration has forward-compatibility verification.

Threshold exceptions require an owner, risk rationale, compensating test/evidence, and expiry. Generated code and type-only declarations may be excluded transparently.

## Merge gates

Formatting, lint, type-check, unit/integration, contract, affected E2E, security scans, migration check, and affected AI evals must pass. Critical/high exploitable security failures, critical accessibility failures, cross-user leaks, data-loss risks, and AI safety regressions block merge/release regardless of percentage coverage.

## Flake and duration budgets

Track rerun rate by suite. Target less than 1% unexplained flake. PR feedback target is under 15 minutes; slower exhaustive suites run nightly and remain release gates.
