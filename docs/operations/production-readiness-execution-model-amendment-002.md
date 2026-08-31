# Execution Model Amendment 002

| Field              | Value                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Status             | `APPROVED` by direct user authorization in this task conversation                                                        |
| Effective scope    | Production Readiness Execution Plan v2.0 and all task records created for it                                             |
| Supersedes         | Reviewer-blocking portions of DEC-001 and plan v2.0 only; historical review evidence remains immutable history           |
| Does not authorize | L2-L6 actions, external writes, production GO, or a change to evidence, test, approval, rollback, or safety requirements |

## Operating model

- `sol high` is the single execution coordinator. It owns task selection, DoR/DoD checks, scope control, self-review, evidence synthesis, and stop/escalation decisions.
- `luna xhigh` subagents perform bounded L0/L1 work packets delegated by the coordinator: inspection, focused implementation, test execution, deterministic validation, and evidence drafting.
- A subagent must receive only `AGENTS.md`, this amendment, the exact task packet, applicable decisions, exact path scope, invariants, and required evidence. It must not reread the entire plan unless the coordinator identifies a conflict or material scope change.
- The coordinator performs direct-evidence self-review after every worker result. A worker result alone never closes a task.

## Reviewer replacement rules

1. Independent AI reviewer tasks are optional and never block `READY`, `VERIFIED`, `REVIEWED`, `CLOSED`, or a gate.
2. Every reference to a required reviewer, independent reviewer, reviewer approval, or review separation in plan v2.0 is replaced by coordinator self-review plus the accountable-human authorization already required for the applicable permission class.
3. `REVIEWED` means the `sol high` coordinator completed direct inspection of the exact diff, commands, raw evidence, secret/PII scan, and invalidation analysis.
4. Existing independent-review records are historical evidence, not requirements for later transitions. Open reviewer-only findings may be dispositioned by the coordinator against direct evidence and this amendment.
5. Duong Vinh remains the final accountable owner and only person who can authorize L2-L6 or issue Production GO/NO_GO. No model can self-authorize those actions.

## Risk acceptance

This amendment knowingly removes independent AI-review separation. The compensating controls are exact task packets, coordinator direct-evidence self-review, retries set to zero for mandatory tests, append-only evidence history, immutable-candidate requirements, and retained human authorization for external or production actions. This is a governance risk acceptance, not evidence that any gate has passed.

## PRD-0002 continuation

The fresh independent review previously required after register hash `2eaf829cd410d34bda82e32fdc8d486b492c17fa286d9b79992bd81cc3590ce1` is no longer a blocker. The coordinator must self-review that exact register before closing PRD-0002.
