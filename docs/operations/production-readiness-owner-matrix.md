# Production Readiness Owner Matrix

| Field                      | Value                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| Decision                   | `DEC-001`, amended by `DEC-001 AMENDMENT 001`                                                             |
| Status                     | `APPROVED`                                                                                                |
| Approval source            | Direct user authorization in this task conversation                                                       |
| Recorded at UTC            | `2026-08-31T13:17:23.3459783Z`                                                                            |
| Amendment approval source  | Direct user authorization in this task conversation                                                       |
| Amendment recorded at UTC  | `2026-08-31T13:31:58.1206945Z`                                                                            |
| Plan                       | v2.0, SHA-256 `3167c6252aa03c8465c30f8c1bbd0d44c381705d97e678dfe4500af5bb81cc97`                          |
| Repository snapshot        | `main` at `d0c09cef4f80cf7d4bcbb6c42328a65e55a5d895`; no immutable candidate exists                       |
| Candidate status           | `NO_GO`; declared/recomputed baseline fingerprints are mismatched and cannot represent a release identity |
| Primary owner and timezone | Duong Vinh; Asia/Bangkok                                                                                  |

## Accountabilities

| Role                                      | Assigned identity                         | Boundary                                                                                                                             |
| ----------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Repository Owner                          | Duong Vinh                                | Scope, candidate policy, and commit provenance; does not self-approve production changes they implement.                             |
| Application Owner                         | Duong Vinh                                | API, web, worker, auth, storage, and AI runtime.                                                                                     |
| Platform/IaC Owner                        | Duong Vinh                                | Terraform, AWS topology, IAM/KMS, and deployment infrastructure.                                                                     |
| CI/CD Owner                               | Duong Vinh                                | Exact-SHA CI, workflow protection, manifest, SBOM, and retention.                                                                    |
| Security Reviewer                         | Independent `sol xhigh` Codex review task | Read-only direct-evidence review; cannot mutate source or approve production.                                                        |
| Data/DB Owner                             | Duong Vinh                                | Migration compatibility, RPO/RTO, and approval of an exact disposable restore target.                                                |
| SRE/Operations Owner                      | Duong Vinh                                | SLOs, monitoring, alerting, load/soak, rollback, and incident readiness.                                                             |
| Evidence Custodian                        | Duong Vinh                                | Evidence index, checksums, retention, and chain of custody; must not alter evidence after approval.                                  |
| Staging Approver                          | Duong Vinh                                | Authorizes staging only after its gate is PASS; does not grant production approval.                                                  |
| Production Approver                       | Duong Vinh                                | Final GO/NO_GO only after independent review and mandatory evidence; cannot approve if Duong Vinh directly implements the candidate. |
| Primary Implementer                       | `terra high` Codex execution task         | L0/L1 work only unless a new explicit authorization grants a higher class.                                                           |
| Executor self-review                      | Same `terra high` execution task          | Mandatory, but never an independent review.                                                                                          |
| Terraform persistent-replacement reviewer | Duong Vinh                                | Must consider an independent `sol xhigh` review before deciding.                                                                     |

## Review separation

1. Every independent technical/security review uses a separate `sol xhigh` Codex task with no implementation role for the reviewed snapshot.
2. The reviewer is read-only and evaluates direct source, diff, tests, and evidence rather than an executor summary.
3. Reviewer findings are append-only evidence. The executor cannot close a reviewer-created finding; an updated exact snapshot requires another independent review.
4. Duong Vinh alone decides staging and production approvals. An AI reviewer cannot approve a gate or production.
5. If Duong Vinh directly edits the candidate, independent human production approval remains absent and G5 stays `NO_GO`.

## Notification and escalation target state

These are approved logical targets only. They do not prove that alerting, subscriptions, or delivery are deployed.

| Environment | Primary channel                                         | Backup record                                            | Owner      | Deployment precondition                                                          |
| ----------- | ------------------------------------------------------- | -------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------- |
| Staging     | AWS SNS topic `ai-interview-practice-staging-alerts`    | GitHub Issue labeled `staging-incident`                  | Duong Vinh | Acknowledgment owner must be available.                                          |
| Production  | AWS SNS topic `ai-interview-practice-production-alerts` | GitHub Issue labeled `production-incident` plus severity | Duong Vinh | Duong Vinh must confirm on-call availability and channel access before a window. |

No email address, phone number, token, subscription endpoint, or endpoint secret may be stored in repository evidence.

## Response expectations

| Context                                 | Severity | Acknowledge | Triage                                              | Escalation / decision                                                                                                                                                       |
| --------------------------------------- | -------- | ----------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staging                                 | Critical | 15 minutes  | Start within 30 minutes                             | Escalate if unacknowledged after 15 minutes; do not continue deployment without an acknowledgment.                                                                          |
| Staging                                 | High     | 30 minutes  | Start within 60 minutes                             | Escalate and record a handling decision within 120 minutes of the first alert timestamp.                                                                                    |
| Production change or observation window | Critical | 5 minutes   | Start within 10 minutes                             | Escalate immediately if unacknowledged after 5 minutes; make rollback/continue decision within 20 minutes; automatic rollback/NO_GO on a stop threshold or monitoring loss. |
| Production outside a window             | Critical | 15 minutes  | Open incident record immediately after confirmation | Escalate if unacknowledged after 15 minutes.                                                                                                                                |
| Production outside a window             | High     | 30 minutes  | Start within 30 minutes                             | Escalate and record a handling decision within 60 minutes of the first alert timestamp.                                                                                     |

### Response-governance rules

- Every deadline begins at the first alert timestamp. Missing acknowledgment or triage by its deadline requires automatic escalation.
- A handling decision must be one of `MITIGATE`, `ROLLBACK`, `DISABLE_AFFECTED_CAPABILITY`, `CONTINUE_MONITORING`, or `DECLARE_INCIDENT` and must have supporting evidence.
- An alert cannot be closed merely because its signal clears; it requires a recorded disposition and evidence.
- Production High is elevated to Critical for data-integrity, authentication/authorization, security-boundary, sustained user-facing outage, or runaway-cost impact.

## Downstream constraints

- PRD-1401 must deploy or map these logical channels to an actual notification system.
- PRD-5009 must prove firing, delivery, acknowledgment, escalation, and resolution with synthetic staging evidence.
- G4 and G5 remain `NO_GO` if a subscription is unconfirmed or synthetic delivery fails.
- This approval grants L0_READ and L1_REPO_WRITE only. It does not authorize staging, Git, cloud, deployment, migration, load/chaos, restore, or production actions.
