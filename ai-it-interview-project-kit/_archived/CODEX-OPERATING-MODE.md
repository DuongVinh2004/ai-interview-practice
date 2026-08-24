# Control Plane operating mode

This project uses ChatGPT/Codex-style reasoning as the **Control Plane** and Antigravity as a bounded local executor. The canonical protocol is `16-codex/SUPERVISOR-PROTOCOL.md`.

## Before execution

1. Verify remote, branch, HEAD and working tree with live repository evidence.
2. Read `AGENTS.md`, the task, acceptance criteria and dependencies.
3. Read only the relevant Project Kit documents and current code/tests.
4. Classify task risk and select applicable review profiles.
5. Create/update an ExecPlan for cross-cutting or high-risk work.
6. Compile one bounded `EXECUTE`, `CORRECT`, `VERIFY` or `COMMIT` prompt.

## During execution

- One task, one branch, one independently reviewable outcome.
- Antigravity may self-repair direct implementation mistakes up to two cycles, but may not weaken tests or requirements.
- Use `MockAiProvider` and synthetic/local fixtures unless a real provider is explicitly authorized.
- Do not log secret, token, OTP, CV, transcript, or prompt containing unnecessary PII.
- Do not use `git add .`; commit remains a separate gate.

## After execution

1. Require the compact `16-codex/HANDOFF-TEMPLATE.md` packet.
2. Independently review the diff; Antigravity's PASS is not approval.
3. On defects, classify root cause and issue a progressively stronger corrective prompt using the convergence controller.
4. Run targeted `VERIFY` for missing/high-risk evidence when needed.
5. Mark `READY_FOR_COMMIT` only after acceptance, verification, scope, test-integrity and applicable risk gates pass.
6. Commit, push, PR, deploy/provider/cloud/Jira are distinct authorization gates.
7. Update `16-codex/state/CURRENT-STATE.yaml` only after Control Plane review.
