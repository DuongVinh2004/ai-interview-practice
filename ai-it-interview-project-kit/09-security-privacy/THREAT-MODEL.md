# Threat model

## Assets

Candidate answers and recordings (future), identity/session data, rubrics and question banks, AI prompts/provider credentials, evaluation results, billing/quota data, audit records, backups, and deployment credentials.

## Trust boundaries

Browser ↔ edge/API; API ↔ PostgreSQL/Redis/object store; API ↔ worker queue; worker ↔ AI provider; CI ↔ registry/cloud; staff ↔ admin surface; backup system ↔ recovery environment.

## Principal threats and controls

| Threat | Example | Primary controls |
|---|---|---|
| Broken ownership | Read another candidate's session by ID | centralized policy, scoped queries, negative tests |
| Session takeover | Refresh-token replay | rotation families, reuse detection, revocation, MFA |
| Privileged misuse | Admin exports answers | least privilege, step-up, approval/audit, alerts |
| Prompt injection | Answer asks model to reveal rubric | instruction isolation, output schema, adversarial eval |
| Data exfiltration | Provider receives excess PII | minimization, redaction, provider contract, egress control |
| Queue abuse | Duplicate finalization or stale job | idempotency, locks/constraints, state version checks |
| Supply-chain compromise | Malicious dependency or image | lockfiles, provenance, SBOM, scans, pinned actions/images |
| Availability attack | Oversized answers and AI fan-out | limits, quotas, circuit breakers, backpressure |
| Backup compromise | Unencrypted or untested copy | encrypted immutable backups, access isolation, restore drills |

## Abuse cases

The system anticipates answer-key extraction, automated scraping of question banks, quota evasion, account farms, harassment content, malicious code submissions, inflated verbosity for scores, and attempts to repurpose scores for recruitment. Each feature must update this model and attach tests or monitoring to material threats.

## Residual-risk review

Review at each release and whenever adding voice, file upload, new provider, organization tenancy, payments, or hiring integrations. Unmitigated high risk requires explicit owner and release decision.
