# Incident response

## Severity

- `SEV-1`: confirmed/likely sensitive-data exposure, admin takeover, cross-user access, widespread outage, or unsafe AI action with material harm.
- `SEV-2`: contained compromise, major degradation, provider failure without safe fallback, or high-risk vulnerability with plausible exploitation.
- `SEV-3`: limited issue with low immediate impact.

## Lifecycle

1. Detect and open a timestamped incident channel/record.
2. Assign incident commander, operations lead, communications lead, and scribe.
3. Preserve evidence; do not place secrets or unnecessary personal data in chat/tickets.
4. Contain using scoped revocation, feature flags, provider circuit breaker, traffic control, or rollback.
5. Eradicate and recover through reviewed changes and health/data-integrity checks.
6. Notify affected parties and authorities according to counsel-approved obligations.
7. Publish a blameless review with root causes, detection gaps, corrective owners, and due dates.

## Prepared playbooks

Maintain tested playbooks for credential leak, refresh-token replay, administrator compromise, ownership bypass, malicious dependency, AI provider breach/outage, prompt-data leakage, corrupted deployment, lost database, and quota/cost runaway.

## Exercises and evidence

Tabletop quarterly; restore/failover and contact-tree exercises at least twice yearly. Track time to detect, acknowledge, contain, recover, notify, and close actions. Incident logs and audit evidence follow legal hold and restricted-access requirements.
