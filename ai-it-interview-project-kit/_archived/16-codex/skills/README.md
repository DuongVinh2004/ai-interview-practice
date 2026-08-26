# Supervisor Skill Pack v1

These repository-local skills define how the Control Plane supervises Antigravity. They are process skills: they do not grant new external permissions and they do not replace Project Kit requirements.

## Core skills

| Skill                            | Trigger                                    | Output                                                |
| -------------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| `antigravity-supervisor`         | Any Antigravity coding/review loop         | task state + routed actions + final verdict           |
| `execution-prompt-compiler`      | Need a new Anti prompt                     | bounded `EXECUTE/CORRECT/VERIFY/COMMIT` prompt        |
| `repository-state-inspector`     | Start/resume task or state uncertainty     | verified baseline packet                              |
| `task-dependency-resolver`       | Before implementation                      | READY / BLOCKED / DECISION_REQUIRED                   |
| `scope-and-deviation-guard`      | Review any diff/handoff                    | scope/spec deviation findings                         |
| `root-cause-debugger`            | Anti fails or produces wrong behavior      | failure class + causal hypothesis + required evidence |
| `corrective-prompt-engine`       | Validated defect requires another Anti run | stronger bounded correction prompt                    |
| `loop-convergence-controller`    | One or more correction attempts            | escalation level / continue / stop                    |
| `verification-and-test-guardian` | Before PASS/commit                         | acceptance/test/risk-profile verdict                  |
| `handoff-state-manager`          | End of every run / chat transition         | compact handoff + updated state checkpoint            |

## Review profiles

`verification-and-test-guardian` loads only applicable profiles from `16-codex/review-profiles/`:

- `auth-security.md`
- `concurrency-idempotency.md`
- `migration-contracts.md`
- `ai-evaluation.md`
- `frontend-accessibility.md`

## Routing principle

Do not invoke every skill/profile mechanically. Use the minimum set that covers the task risk.

Typical routes:

### Small documentation or narrow code task

`repository-state-inspector -> task-dependency-resolver -> execution-prompt-compiler -> antigravity-supervisor -> scope-and-deviation-guard -> verification-and-test-guardian -> handoff-state-manager`

### Auth/MFA task

Add `auth-security` profile and use deeper negative verification.

### Queue/concurrency task

Add `concurrency-idempotency` profile.

### Schema/API/event migration task

Add `migration-contracts` profile.

### AI scoring/provider task

Add `ai-evaluation` profile and decision-gate checks.

### Failed run

`root-cause-debugger -> loop-convergence-controller -> corrective-prompt-engine -> antigravity-supervisor -> verification-and-test-guardian`
