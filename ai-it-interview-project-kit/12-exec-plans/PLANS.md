# Execution-plan standard

Use an ExecPlan for work spanning multiple modules, migrations, security/privacy boundaries, provider changes, infrastructure, or more than one focused coding session. The plan is a living, self-contained engineering record.

## Required properties

- A new contributor can execute it using only the repository and linked stable sources.
- It starts with measurable purpose and observable user/operational outcome.
- It records baseline evidence, constraints, non-goals, dependencies, decision gates, risks, and exact validation.
- Progress is a timestamped checklist; discoveries and decisions are appended with evidence.
- Steps are idempotent or describe safe recovery.
- It specifies rollout, rollback, data migration, observability, and evidence retention.

## Workflow

Create the plan on the task branch, review risky choices before implementation, update it after every meaningful discovery, and close it with outcomes versus acceptance criteria. Do not mark a milestone complete because code exists; mark it complete after the stated behavior and evidence are verified.

## Execution Plans Index

- `M0-BASELINE-HARDENING.md`: Milestone M0 baseline hardening and verification.
- `M1-AI-EVAL-FOUNDATION.md`: Milestone M1 evaluation harness and contract foundation.
- `M4-PLATFORM-OPERATIONS-AND-LAUNCH.md`: Milestones M4 & M5 Platform Operations, IaC, Observability, Disaster Recovery & Release Readiness.

## Stop conditions

Pause when official baseline cannot be verified, required credentials/approval are missing, a migration risks unrecoverable data, a security/privacy boundary changes, tests reveal cross-user leakage, or a deferred decision gate is reached.

