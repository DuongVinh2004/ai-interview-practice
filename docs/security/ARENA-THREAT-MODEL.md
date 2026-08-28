# Threat Model — AnyF Engineering Arena (ARENA-003)

**Status:** Active  
**Risk Level:** High (Candidate untrusted code execution)

---

## 1. Identified Threats and Security Mitigations

| Threat                                           | Description                                                                                  | Impact   | Mitigation Control                                                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| **T1: Host Sandbox Escape**                      | Candidate code attempts to break container boundaries or gain host root access.              | Critical | Run unprivileged (`non-root` user, `no-new-privileges`, read-only root FS, seccomp profile, dropped capabilities).          |
| **T2: Network Data Exfiltration**                | Candidate code calls external URLs or accesses cloud metadata endpoints (`169.254.169.254`). | High     | Disable container networking (`--network none` / iptables block).                                                           |
| **T3: Hidden Test Leakage**                      | Candidate prints or reads hidden test files from disk.                                       | High     | Keep hidden tests on server-side only; inject dynamically only during final verification run, or mount in ephemeral memory. |
| **T4: Resource Exhaustion (DoS)**                | Fork bombs, memory leaks, infinite CPU loops, disk fill.                                     | High     | Hard limits on CPU (1 vCPU), Memory (512MB), Disk writes (50MB tmpfs), and Execution Timeout (15s hard kill).               |
| **T5: Platform Secret Exfiltration**             | Accessing backend DB connection strings, API keys via environment variables.                 | Critical | Zero host environment inheritance into runner container; strict explicit env allowlist.                                     |
| **T6: Broken Object Level Authorization (BOLA)** | User A reads/modifies User B's arena session or workspace files.                             | High     | Strict `ArenaSessionOwnershipGuard` verifying `session.userId === req.user.id`.                                             |
| **T7: Prompt Injection via Code/Comments**       | Malicious code comments attempting to trick the AI Evaluator into giving 100%.               | High     | Separate code content into isolated data payload; evaluation prompt enforces rubric strictly with objective test dominance. |
| **T8: State Tampering / Race Conditions**        | Submitting twice simultaneously to bypass quota or corrupt scores.                           | Medium   | DB unique constraint on active submissions, Redis distributed locks, and idempotency keys.                                  |

---

## 2. Release Gate Checklist

- [x] Host environment scrubbed before sandbox launch.
- [x] Ephemeral runner filesystem clean-up post-execution.
- [x] Ownership verification on all Arena endpoints.
- [x] Rate limiting per candidate session.
