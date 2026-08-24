# Release gates

## Mandatory

- Scope/acceptance and traceability are current.
- CI on the exact immutable artifact is green.
- Schema migration compatibility and rollback/restore path are verified.
- No unresolved critical/high exploitable security finding; SBOM and scan evidence exist.
- Auth ownership/MFA, queue concurrency, critical E2E, accessibility, load, and AI safety/quality gates pass.
- SLO dashboards, alerts, log/trace redaction, quota/cost monitors, runbooks, on-call, and incident contacts are ready.
- Backup restore evidence is within schedule; production config/secrets use approved management.
- Privacy notice, retention, data rights, subprocessors, and required assessments are approved.

## Conditional

New provider/model, rubric weights, voice, payment, market, tenant model, or major data field requires its named decision gate and threat/privacy/AI-eval delta.

## Go/no-go record

Record artifact digest, commit, migrations, feature flags, approvers, unresolved risks/expiry, canary cohort, health thresholds, automatic rollback conditions, start/end time, and outcome. A release is complete only after the observation window and evidence readback.
