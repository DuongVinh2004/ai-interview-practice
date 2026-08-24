# Git and review workflow

Use protected `main` with short-lived task branches (`feat/AIP-123-short-name`, `fix/...`, `chore/...`). Trunk-based delivery is preferred; release branches are exceptional and time-bounded. Never commit directly to protected `main`.

## Pull requests

One coherent task per PR. Include outcome, issue, design/ADR link, security/privacy/AI impact, migrations/contracts, tests and exact commands, screenshots for UI, rollout/rollback, and residual risks. Keep commits reviewable and use conventional subject prefixes where practical.

## Required review

At least one independent approval; two for high-risk auth/IAM, data deletion, provider, billing, CI/IaC, migration, or scoring changes. CODEOWNERS approval is mandatory for controlled paths. Authors cannot approve their own high-risk change. Resolve conversations before merge.

## Merge discipline

Require up-to-date green checks, signed/verified provenance where configured, linear history/squash policy chosen consistently, and automatic branch deletion. Never rewrite shared history, bypass checks, force-push protected branches, or place secrets in commits. Emergency merge requires named approver, incident/change record, and retrospective review.
