# SLO and alerting

Initial production targets require measurement and approval after realistic load tests.

| Journey | SLI | Initial objective |
|---|---|---|
| Sign in/session resume | successful valid requests | 99.9% monthly |
| Core API | non-5xx valid requests | 99.9% monthly |
| Answer persistence | durable accepted submissions | 99.99% monthly |
| Core read latency | server p95 | ≤ 300 ms |
| Answer acknowledge | server p95 excluding AI completion | ≤ 800 ms |
| Evaluation completion | completed within 60 s when provider healthy | 99% |
| SSE freshness | event delivered within 5 s | 99% |
| Backup | scheduled jobs successful | 100% with immediate investigation |

AI-provider availability is measured separately so core persistence can remain healthy in degraded mode. Publish user-visible availability only after defining exclusions precisely.

## Alert policy

Page on sustained user impact, rapid error-budget burn, answer persistence failure, cross-user/security signal, database unavailability, severe queue age, backup failure, or runaway AI spend. Ticket slow burns, capacity forecasts, isolated retries and quality drift. Avoid per-error pages.

Each alert has symptom, impact, threshold/window, owner, runbook, dependency context, dashboard, and auto-resolution. Review noisy/stale alerts monthly and after incidents.
