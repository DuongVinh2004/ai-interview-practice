# Team ownership

## Accountable areas

| Area | Accountable role | Required reviewers |
|---|---|---|
| Product boundary and metrics | Product owner | engineering, AI/content |
| Auth, IAM, admin MFA | Security/backend owner | security + backend |
| Interview/state/queues | Backend owner | backend + QA |
| AI contracts/evals | AI quality owner | content + security/privacy |
| Taxonomy/questions/rubrics | Content owner | second content reviewer |
| Web/accessibility/i18n | Frontend owner | QA/accessibility |
| Data/migrations/retention | Data/backend owner | security + operations |
| IaC/CI/CD/observability/DR | Platform owner | security + backend |
| Privacy/compliance | Privacy owner/counsel | product + security |

Named individuals are maintained in the issue tracker/CODEOWNERS, not duplicated here. Duong Vinh is the repository steward until ownership is explicitly delegated.

## Operational responsibilities

Every production service/module has an owner, backup owner, SLO, dashboard, alert route, runbook, dependency map, data classification, and deprecation path. On-call owns response, not every remediation; the domain owner owns permanent corrective work.

## Separation of duties

Content author cannot self-publish material scoring changes. A developer cannot alone grant production access, approve a high-risk PR, and deploy it. Emergency access is time-bound and retrospectively reviewed.
