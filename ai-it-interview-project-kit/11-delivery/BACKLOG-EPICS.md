# Backlog epics

| Epic | Outcome | Exit evidence |
|---|---|---|
| E01 Baseline truth | docs/CI match runnable repository | inventory, green clean build |
| E02 Identity hardening | safe password/session lifecycle | replay/ownership test matrix |
| E03 Admin MFA/IAM | privileged access is step-up protected | MFA bypass and audit tests |
| E04 Interview core | legal, resumable state machine | transition/concurrency tests |
| E05 Content governance | reviewed, versioned taxonomy/questions/rubrics | author-review-publish audit |
| E06 AI contracts | provider-independent structured outputs | contract fixtures |
| E07 AI evals | measurable quality/safety VI/EN | golden/adversarial report |
| E08 Provider integration | reliable/cost-bounded provider | selection ADR, load/failure test |
| E09 Feedback/learning | evidence-based actionable results | UX/E2E acceptance |
| E10 Accessibility/i18n | usable VI/EN WCAG 2.2 AA | automated/manual report |
| E11 Privacy rights | transparent lifecycle and user control | export/delete/retention evidence |
| E12 Security program | secure SDLC and abuse resistance | scans, threat model, pen-test plan |
| E13 Platform/IaC | reproducible environments | plan/apply evidence, drift check |
| E14 Observability/SRE | SLO-driven operations | dashboards, alerts, game day |
| E15 Backup/DR | recoverable data and services | restore and failover drill |
| E16 Controlled launch | measurable safe pilot | release dossier and sign-off |

Tasks are tracked in `jira-backlog.csv`. Dependencies are outcome-based: E01–E04 precede production AI; E06–E07 precede E08; E02–E05 and E11–E15 precede launch.
