# CI/CD design

## Pull-request pipeline

Install from lockfile; validate formatting/lint/types; build; run unit/integration/contract and affected E2E/AI suites; rehearse migrations; scan secrets/dependencies/SAST/IaC/container/licenses; produce test/security summaries. Cache only integrity-addressed dependencies and never secrets.

## Artifact pipeline

Build once from reviewed commit. Produce immutable images/artifacts with commit/version labels, SBOM, provenance/attestation and vulnerability report. Sign where supported. Promote the same digest through staging and production.

## Deployment

Use OIDC/short-lived environment identities, protected environments, scoped approvals, IaC plan review, preflight config/secret checks, compatible migrations, canary traffic, automated health/SLO gates, then progressive rollout. Production is not deployed from a developer workstation.

## Supply-chain controls

Pin third-party actions to immutable revisions, restrict workflow token permissions, separate untrusted PR jobs from secrets, protect environments, verify base-image provenance, and schedule dependency updates with full gates.

## Failure behavior

Failed test/scan/migration blocks promotion. Failed canary stops and rolls back application automatically when safe. The pipeline records artifact digest, environment, actor, approvals, migrations, start/end, health result, rollback, and evidence links.
