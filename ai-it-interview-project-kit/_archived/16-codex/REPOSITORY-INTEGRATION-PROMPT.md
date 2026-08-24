# Prompt: integrate the Project Kit and Supervisor Skill Pack into the official repository

Use this as the first Antigravity integration run when the Project Kit ZIP is available locally. The Control Plane should review the resulting handoff/diff before any commit unless the prompt is deliberately changed to authorize one.

```text
MODE: EXECUTE
TASK: BOOTSTRAP — integrate the AI IT Interview Project Kit and Antigravity Supervisor Skill Pack as documentation/control-plane assets only
OFFICIAL_REPOSITORY: https://github.com/DuongVinh2004/ai-interview-practice.git
CONTROL_PLANE_VERDICT_REQUIRED: YES

AUTHORIZATION
- clone/fetch/read official repository: yes
- create one local docs branch: yes
- copy/update planning documentation: yes
- edit product code: no
- local commit: no
- push/PR/merge/deploy/cloud/Jira/real-provider calls: no

SOURCE
- local folder `ai-it-interview-project-kit/` from the approved ZIP

READ FIRST
- repository root AGENTS.md/instructions if present
- Project Kit `AGENTS.md`
- `16-codex/CHAT-BOOTSTRAP.md`
- `16-codex/SUPERVISOR-PROTOCOL.md`
- `16-codex/skills/README.md`
- `16-codex/STOP-CONDITIONS.md`

REQUIRED OUTCOME
Safely integrate the entire Project Kit, including Supervisor Skill Pack v1, into the official repository as planning/documentation only. No product feature implementation.

PROCESS
1. Inspect repository status, remotes, default branch, latest commit, architecture, package scripts, CI, migrations, tests and docs.
2. Confirm origin owner/name exactly. If it differs, or overlapping dirty user work exists, STOP and report.
3. Compare the kit's repository baseline statements with current live repository evidence. Current repository evidence is authoritative for current state; update only stale baseline statements and record each adjustment.
4. Create a short-lived local branch such as `docs/ai-interview-project-kit` from the appropriate verified base without touching unrelated user branches.
5. Place the kit in `docs/ai-it-interview-project-kit/` unless live repository instructions specify a better docs path. Preserve existing files. Add only a minimal root README/AGENTS pointer if non-conflicting.
6. Preserve the supervisor architecture: Control Plane owns reasoning/review/correction; Antigravity is a bounded executor. Do not rewrite it into an autonomous-agent workflow.
7. Validate local Markdown references introduced by the kit, JSON syntax/schema files, YAML parseability, CSV shape, absence of secrets/personal data, and repository documentation quality commands that actually exist.
8. Review the full diff. Do not commit.
9. Return the exact `16-codex/HANDOFF-TEMPLATE.md` packet plus a patch/full diff path for Control Plane review.

NON-NEGOTIABLE BOUNDARIES
- Product is AI-assisted IT interview practice only; no hiring recommendation/ranking or protected-trait/emotion/personality/lie inference.
- Admin MFA and least-privilege authorization remain requirements.
- Do not force microservices or providers merely because the target architecture discusses scale.
- Provider/model, cloud, payment and voice remain decision gates.
- Never fabricate tests, evidence, repository state or external actions.
```

After Control Plane review returns `READY_FOR_COMMIT`, use a separate `MODE: COMMIT` prompt that stages only reviewed documentation paths and creates one local commit. Do not push.
