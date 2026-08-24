# Bounded contexts

| Context | Trách nhiệm | Không sở hữu |
|---|---|---|
| Identity | User, credential, session, MFA, role | Interview content |
| Taxonomy | Role, level, technology, competency | User progress |
| Interview | Blueprint, session, question snapshot, attempt | Model configuration |
| AI Orchestration | Provider adapter, prompt, structured output, job | Business score truth |
| Evaluation | Rubric, evaluation run, evidence, calibration | Authentication |
| Learning | Competency profile, recommendation, plan | Raw credential |
| Content Governance | Question bank, rubric/prompt review/version | Runtime session ownership |
| Reporting | History, share grants, progress read models | Primary write invariants |
| Administration | Feature flag, quota, audit, provider config | Transcript viewing by default |
| Operations | Health, metrics, incident, backup | Domain decisions |

Các context tiếp tục là NestJS module trong modular monolith hiện hữu. Giao tiếp qua application service, shared Zod contract và event/job contract; không truy cập Prisma table của module khác nếu không có contract/owner rõ.
