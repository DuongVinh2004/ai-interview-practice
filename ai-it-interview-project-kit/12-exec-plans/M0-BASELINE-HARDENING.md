# M0 baseline hardening ExecPlan

## Purpose

Turn the current repository into a truthful, reproducible, secure foundation before expanding product features or selecting an AI provider.

## Baseline

Official baseline is `DuongVinh2004/ai-interview-practice` `main` at `1a66615416e2ea2471951639e1b25b8b12c75f9a` as observed on 2026-08-23. It is a pnpm monorepo with NestJS/React/PostgreSQL/Redis/BullMQ, shared Zod contracts, mock AI provider, Docker Compose, Nginx and CI. Verify again at execution time.

## Outcomes

- Clean documented bootstrap and one-command local verification.
- CI matches repository scripts and real dependencies.
- Prisma migration history exists and rehearses from empty plus previous schema.
- Session refresh families/reuse detection and ownership enforcement are complete.
- Admin MFA is mandatory with recovery and step-up tests.
- Critical state/queue invariants have real PostgreSQL/Redis tests.
- Security scanning, structured telemetry, evidence register, and release gates are active.

## Milestones

- [ ] Re-audit baseline, dirty state, branches, scripts, migrations and docs; create issue mapping.
- [ ] Make build/lint/type/test/compose commands deterministic; fix only evidenced failures.
- [ ] Implement compatible migration baseline and CI migration rehearsal.
- [ ] Harden auth/session/ownership and add admin MFA behind a safe rollout flag.
- [ ] Add concurrency/idempotency tests and audit invariants.
- [ ] Add security scans, redaction tests, dashboards/alerts skeleton and evidence readback.

## Verification

Run format/lint/type/build/unit/integration/contract/E2E, migration from empty and upgrade fixture, refresh replay/concurrent tests, ownership negative matrix, MFA bypass/recovery tests, queue crash/duplicate tests, dependency/secret/SAST/IaC/image scans, and Docker health smoke. Record exact commands after inspecting package scripts; do not invent them.

## Rollout/rollback

Schema changes use expand/migrate/contract. Enforce MFA first for new admins, then existing admins after enrollment window; emergency recovery is audited. Session changes allow bounded old/new compatibility and revoke safely on suspected replay. Roll back application via immutable artifact; never roll back a destructive migration without verified restore.

## Stop conditions

Stop for uncommitted user work overlap, unknown production schema, inability to recover admin access, failing cross-user tests, exposed secrets, or any destructive migration without backup/restore evidence.
