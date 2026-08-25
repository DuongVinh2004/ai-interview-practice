# Quality scorecard

Score each capability from 0 to 4 and attach evidence. Averages cannot compensate for a failed mandatory gate.

| Score | Meaning                                      |
| ----: | -------------------------------------------- |
|     0 | absent or unknown                            |
|     1 | documented intent only                       |
|     2 | implemented partially; weak evidence         |
|     3 | implemented and verified in staging          |
|     4 | production-proven with monitored improvement |

| Capability                 | Launch minimum | Evidence             |
| -------------------------- | -------------: | -------------------- |
| Functional correctness     |              3 | EV-002               |
| Maintainability/contracts  |              3 | EV-001 EV-002 EV-008 |
| Security and IAM/MFA       |              3 | EV-003 EV-007        |
| Privacy/compliance         |              3 | EV-011               |
| AI quality/faithfulness    |              3 | EV-004               |
| AI safety/boundary         |              3 | EV-004 EV-007        |
| Accessibility/VI-EN        |              3 | EV-005               |
| Performance/scalability    |              3 | EV-006               |
| Availability/observability |              3 | EV-009               |
| Backup/DR                  |              3 | EV-010               |
| CI/CD/supply chain         |              3 | EV-001 EV-007 EV-012 |
| Operability/support        |              3 | EV-009 EV-012        |

Mandatory no-go conditions include cross-user leakage, admin MFA bypass, data-loss risk, unrecoverable migration, critical/high exploitable vulnerability, unsafe AI boundary failure, material unsupported evaluation claims, inaccessible critical journey, failed restore, or absent incident/on-call ownership.
