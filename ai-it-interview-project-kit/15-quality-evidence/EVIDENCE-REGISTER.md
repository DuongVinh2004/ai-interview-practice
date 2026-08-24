# Quality evidence register

This register is the index, not the evidence itself. Store large/raw CI artifacts in the approved artifact system and link immutable identifiers.

| Evidence ID | Area | Required artifact | Cadence | Owner | Latest | Status |
|---|---|---|---|---|---|---|
| EV-001 | Build | clean clone install/build log | release | Platform | pending | missing |
| EV-002 | Tests | unit/integration/contract/E2E summary | PR/release | QA | pending | missing |
| EV-003 | Auth | refresh/ownership/MFA negative suite | release | Security | pending | missing |
| EV-004 | AI quality | golden/adversarial comparison report | model/release | AI Quality | pending | missing |
| EV-005 | Accessibility | automated and manual WCAG report | release | Accessibility | pending | missing |
| EV-006 | Performance | load/soak/failure report | release | Performance | pending | missing |
| EV-007 | Security | scan/SBOM/penetration evidence | release | Security | pending | missing |
| EV-008 | Migration | empty and upgrade rehearsal | migration/release | Data | pending | missing |
| EV-009 | Observability | dashboard/alert game day | quarterly/release | SRE | pending | missing |
| EV-010 | Backup/DR | isolated restore/failover drill | quarterly | Data Platform | pending | missing |
| EV-011 | Privacy | processing inventory/DPIA/rights test | launch/change | Privacy | pending | missing |
| EV-012 | Release | digest/approvals/canary/rollback record | release | Release | pending | missing |

Statuses are `missing`, `draft`, `valid`, `expired`, or `failed`. Evidence includes date, commit/artifact digest, environment, method, outcome, limitations, owner, expiry, and link. A claim in README or release notes must map to valid evidence.
