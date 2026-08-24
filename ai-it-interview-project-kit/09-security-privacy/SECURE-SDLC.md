# Secure SDLC

## Before coding

Every epic identifies assets, trust boundaries, abuse cases, privacy data, permissions, observability, rollback, and acceptance tests. Security-critical changes name a reviewer independent of the author.

## Pull-request gates

- Formatting, lint, type-check, unit, integration, contract, and relevant E2E tests.
- Secret, dependency, SAST, IaC, Docker/image, and license scans.
- Database migration compatibility and rollback review.
- Authorization negative tests for new resource endpoints.
- AI golden/adversarial tests for prompts, rubrics, models, parsers, and provider adapters.
- CODEOWNERS approval for auth, IAM, admin, AI security, CI/CD, infrastructure, migrations, and data retention.

CI uses pinned third-party actions and least-privileged short-lived credentials. Forked/untrusted code never receives production secrets. Build artifacts are immutable, signed or attested where supported, and promoted between environments rather than rebuilt.

## Vulnerability management

Publish a security contact and supported-version policy. Triage findings for reachability and impact, not scanner severity alone. Track owner, SLA, fix, verification, disclosure decision, and regression test. Perform penetration testing before public production and after major trust-boundary changes.

## Production change

Require approved release evidence, canary/health gates, automatic rollback criteria, audit trail, and a tested incident path. Emergency changes receive retrospective review within two business days.
