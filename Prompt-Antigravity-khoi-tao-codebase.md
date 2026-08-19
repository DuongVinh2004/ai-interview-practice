# Master Prompt for Antigravity — AI Interview Practice Codebase

Copy the complete prompt below into Antigravity while it is opened at the root of this repository:

`https://github.com/DuongVinh2004/ai-interview-practice`

---

## PROMPT START

You are a senior full-stack architect and hands-on staff engineer. Work directly inside the current repository and create the initial production-grade codebase for **AI Interview Practice**.

This repository is currently empty. Your task in this run is to build a reliable foundation and a working end-to-end vertical slice. Do **not** attempt to finish every product feature with shallow placeholder code. The result must be runnable, testable, documented, and suitable for a four-person team to extend during a one-month MVP.

### 1. Source-of-truth and decision priority

Apply decisions in this order:

1. The architecture and technology constraints in this prompt are mandatory.
2. The P0 functional scope and domain rules in this prompt are mandatory.
3. Existing repository conventions must be preserved if they appear after you inspect the repository.
4. When a minor implementation detail is unspecified, choose the simplest secure, maintainable option and document it in an ADR.

Do not silently change the stack, add a microservice, or add a feature outside the stated scope.

### 2. Product context

The product lets a candidate practice an IT interview in text form:

1. The candidate registers or signs in.
2. The candidate selects a job role, seniority level, and technologies.
3. The system creates an interview session containing exactly **five questions**.
4. Questions are generated asynchronously and adapt to the previous answer score.
5. The candidate submits one text answer for each question.
6. The system evaluates each answer asynchronously with a structured rubric.
7. After five questions, the system calculates an overall result and generates a learning path.
8. The candidate can view history and result details.
9. An admin can search users and soft-lock or unlock an account.

The MVP is text-only. It does not contain a coding interview.

### 3. Mandatory technology stack

Use TypeScript across the repository.

- Monorepo: `pnpm` workspaces. Keep the setup simple; do not add Nx or Turborepo unless an existing repository constraint requires it.
- Frontend: React, Vite, TypeScript, React Router, TanStack Query, Zustand, React Hook Form, Zod, Tailwind CSS, and shadcn-compatible UI primitives.
- Backend: NestJS as a **modular monolith**, REST API, OpenAPI/Swagger.
- Database: PostgreSQL and Prisma ORM.
- Async processing: Redis and BullMQ. A worker is part of the NestJS application codebase and can run as a separate process.
- Realtime progress: Server-Sent Events (SSE), with REST polling fallback.
- AI: provider abstraction, AI Orchestrator, versioned prompts, structured JSON output, and schema validation.
- Backend tests: Jest and Supertest.
- Frontend tests: Vitest and React Testing Library.
- End-to-end tests: Playwright.
- Local operations: Docker Compose.
- CI: GitHub Actions.
- Reverse proxy example: Nginx.

Use the latest stable, mutually compatible versions available in the environment. Pin the resolved versions in the lockfile. Do not use `latest` tags in Docker images.

### 4. Scope of this run

Create a production-grade initial codebase, not a disposable prototype. Complete all items below.

#### 4.1 Repository foundation

- `pnpm-workspace.yaml`, root scripts, shared TypeScript/ESLint/Prettier configuration, `.editorconfig`, `.gitignore`, `.env.example`, and `README.md`.
- Root commands for install, development, build, lint, type-check, test, E2E, database migration, database seed, and Docker startup.
- Consistent Node and pnpm version declarations.
- A package-boundary rule that prevents arbitrary cross-module imports.
- Conventional, clear naming. Avoid generic folders such as `utils` when a domain-specific name is possible.

#### 4.2 Applications and packages

Create at least this structure, adapting only when technically necessary:

```text
ai-interview-practice/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── contracts/
│   ├── eslint-config/
│   └── tsconfig/
├── infra/
│   └── nginx/
├── docs/
│   ├── adr/
│   ├── architecture.md
│   └── api-conventions.md
├── .github/workflows/
├── docker-compose.yml
├── pnpm-workspace.yaml
└── README.md
```

`packages/contracts` may contain framework-neutral enums, event names, shared response types, and schemas. Do not put Prisma models, NestJS services, React components, environment secrets, or business logic in this package.

#### 4.3 NestJS modular-monolith boundaries

Create these modules with explicit public APIs and no circular dependency:

- `auth`: registration, login, current user, password change, token lifecycle, account status checks.
- `profile`: candidate profile.
- `taxonomy`: job roles, levels, and technologies.
- `interview`: interview configuration, sessions, turns, answers, and session state machine.
- `ai-orchestrator`: provider abstraction, prompt registry, schema validation, AI-run audit metadata, and adaptive-difficulty rule.
- `evaluation`: evaluation rubric and persisted feedback.
- `learning-path`: generated gaps, topics, priorities, and actions; independent retry status.
- `history-report`: paginated interview history and result detail queries.
- `admin`: user search and soft lock/unlock.
- `platform`: Prisma, Redis/BullMQ, SSE event delivery, configuration, logging, health checks, and global error handling.

Business modules must not import another module's repository or Prisma implementation directly. Communicate through exported application services, ports, or domain events. The AI provider must never update the interview state machine directly.

### 5. Domain invariants

Implement these as explicit code-level rules, not comments:

- Exactly five accepted answers per completed interview session.
- A session state is one of `CREATED`, `ACTIVE`, `EVALUATING`, `COMPLETED`, `CANCELLED`, or `FAILED`.
- Valid main flow: `CREATED -> ACTIVE -> EVALUATING -> ACTIVE`, repeated until the fifth answer, then `EVALUATING -> COMPLETED`.
- Invalid transitions must return a domain conflict error and must be tested.
- Learning-path status is independent: `PENDING`, `READY`, or `FAILED`.
- Failure to generate a learning path does not change a completed session or erase its score. Regeneration is idempotent.
- A submitted answer is persisted before its BullMQ job is enqueued.
- One question can have only one accepted answer. Duplicate submissions with the same idempotency key return the original result; conflicting duplicate submissions return `409`.
- Text answers are limited to 5,000 characters.
- Difficulty is an integer from 1 to 3. After an evaluated answer: score `>= 8` increases difficulty by one; score `<= 5` decreases it by one; otherwise it stays unchanged. Clamp the value to 1–3.
- AI output never writes directly to the database. It must pass schema validation and sanitization before an application service persists it.
- AI operations time out and retry no more than two times with backoff. A final failure produces an explicit failure code without rolling back the already-saved answer.
- Do not expose or store an AI-generated learning-resource URL unless it comes from a curated system-owned catalogue. For the initial codebase, return topics, actions, and search keywords rather than invented URLs.
- A candidate may only access their own sessions, answers, evaluations, history, and results.
- An admin cannot lock their own account. Locking is soft; history remains intact.

### 6. Initial Prisma model

Design a normalized Prisma schema covering at least:

- `User`, `UserProfile`, `RefreshToken`
- `JobRole`, `SeniorityLevel`, `Technology`
- the required join table for selected session technologies
- `InterviewSession`, `InterviewTurn`, `Question`, `Answer`
- `Evaluation`
- `LearningPath` and its structured items, or a justified JSON design if query requirements do not need separate rows
- `AiRun`, `PromptVersion`
- `AuditLog`

Add appropriate unique constraints, foreign keys, cascade/restrict behavior, timestamps, soft-lock fields, session-state indexes, ownership indexes, and pagination/filter indexes. Use decimal-safe or integer score storage consistently and explain the choice.

Create an initial migration and an idempotent seed containing:

- one admin and one candidate demo account;
- several active job roles, levels, and technologies;
- versioned prompt records or prompt seed metadata;
- no real secret or production password.

Document demo credentials as development-only values loaded from environment variables.

### 7. REST and SSE conventions

Use the prefix `/api/v1`. Provide Swagger documentation and examples.

Use a consistent success and error contract. The error body must include a stable machine-readable code, human-readable message, optional field errors, request ID, and timestamp. Do not expose stack traces in production.

Provide at least these endpoint groups and define DTOs even when a later feature is initially scaffolded:

- `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/change-password`
- `/profile`
- `/taxonomies/job-roles`, `/taxonomies/levels`, `/taxonomies/technologies`
- `/interviews`, `/interviews/:id`, `/interviews/:id/answers`, `/interviews/:id/status`
- `/interviews/:id/events` for SSE
- `/interviews/history`
- `/interviews/:id/result`
- `/interviews/:id/learning-path/regenerate`
- `/admin/users`, `/admin/users/:id/lock`, `/admin/users/:id/unlock`
- `/health/live`, `/health/ready`

For write operations that can be retried by the client, support an `Idempotency-Key` header and persist enough information to make its behavior reliable.

Use Bearer authentication for REST. Do not put long-lived tokens in local storage or in SSE query parameters. For authenticated SSE, use an authenticated fetch-based stream or another documented secure approach that supports authorization headers and reconnection. Polling `/interviews/:id/status` must remain a supported fallback.

### 8. BullMQ and AI design

Create named queues and typed job payloads for:

- generating a question;
- evaluating an answer;
- generating or regenerating a learning path.

Job payloads should carry identifiers, not full sensitive domain objects. Configure bounded retries/backoff, remove/retain policies, concurrency from configuration, and deterministic job IDs for idempotency.

Create an `AiProvider` interface and two adapters:

1. `MockAiProvider`: deterministic, fast, and used by local development, CI, and E2E tests without a network API key.
2. `ExternalAiProvider`: a configuration-driven adapter boundary with a safe implementation skeleton. It must fail fast with a clear configuration error when enabled without credentials. Never fake a successful external call.

Define and validate structured schemas for:

- generated question;
- answer evaluation containing overall score, component scores, strengths, improvements, concise feedback, and evidence;
- learning path containing gaps, topics, priority, action, and search keywords.

Persist model/provider name, prompt version, latency, token usage when available, estimated cost when available, result status, and normalized error code. Never log an API key, access token, refresh token, password, or an unnecessarily complete answer body.

### 9. Working vertical slice required in this run

The initial codebase is accepted only if this minimal flow works with `MockAiProvider`:

1. Start PostgreSQL and Redis with Docker Compose.
2. Run migration and seed.
3. Start API, worker, and web application.
4. Register or sign in as a candidate.
5. Load taxonomy values from the real API.
6. Create an interview session.
7. Enqueue generation of the first question.
8. Receive job/session progress through SSE or polling fallback.
9. Display the first generated question in the web application.
10. Submit one text answer once, with idempotency protection.
11. Evaluate it asynchronously through BullMQ and persist structured feedback.
12. Display the feedback and updated session state.

It is acceptable in this run for questions 2–5, the final learning path UI, full history UI, and admin UI to be well-defined module scaffolds rather than fully implemented screens. However, do not create endpoints that return fake success. An unfinished operation must be clearly marked and excluded from the advertised working flow.

### 10. Frontend foundation

Create:

- application shell and responsive navigation;
- public and protected routes;
- sign-up and sign-in pages;
- interview setup page;
- interview room for the required vertical slice;
- reusable loading, empty, error, and retry states;
- global API error normalization;
- TanStack Query keys and hooks organized by feature;
- minimal Zustand state only for truly client-owned state;
- React Hook Form and Zod validation;
- accessible labels, focus states, keyboard behavior, and semantic elements.

Do not duplicate server state in Zustand. Prevent double submissions. Show clear states for `CREATED`, `ACTIVE`, `EVALUATING`, and `FAILED`. Reconnecting or refreshing the page must restore progress from the API.

Keep UI styling clean and neutral. Do not spend the run building a large custom design system.

### 11. Security and observability baseline

Implement or configure:

- secure password hashing;
- short-lived access tokens and refresh-token rotation or another equally secure documented strategy;
- authorization and ownership guards;
- account-lock checks during login and authenticated requests;
- DTO validation, payload limits, CORS allowlist, Helmet, and rate limiting, especially for auth and AI-triggering endpoints;
- centralized configuration validation at startup;
- structured logs with request/job correlation IDs and redaction;
- graceful shutdown for HTTP server, Prisma, Redis, and workers;
- liveness and readiness checks;
- no secrets committed to Git.

### 12. Testing baseline

Add meaningful tests, not test placeholders:

- unit tests for session transitions, adaptive difficulty, schema validation, idempotency behavior, and learning-path independent failure;
- Supertest coverage for auth, ownership, account lock, interview creation, answer validation, and the vertical-slice status endpoints;
- React tests for form validation, protected routes, interview progress states, and double-submit prevention;
- one Playwright happy path using `MockAiProvider` from login through first-answer feedback;
- at least one failure-path test for an AI schema error or exhausted retry.

Tests must be deterministic and must not call a paid or external AI provider.

### 13. Local environment, CI, and documentation

Provide Docker Compose services for PostgreSQL and Redis, and optionally app profiles when helpful. Add health checks and named volumes. Provide a production-oriented multi-stage Dockerfile for web, API, and worker execution.

Create a GitHub Actions workflow that runs at least:

1. frozen-lockfile install;
2. formatting check;
3. lint;
4. type-check;
5. unit/integration tests;
6. build;
7. a deterministic smoke test with `MockAiProvider` where practical.

Write documentation for:

- architecture and module boundaries;
- the async answer-processing sequence;
- session and learning-path state machines;
- environment variables;
- setup from a fresh clone;
- database migration and seed;
- starting API, worker, and web;
- running each test category;
- Swagger location;
- common troubleshooting for PostgreSQL, Redis, BullMQ, and SSE;
- how a developer can add a new AI provider without changing business modules.

Add short ADRs for at least the modular-monolith boundary, SSE plus polling fallback, AI provider abstraction, and answer persistence before enqueue.

### 14. Explicit exclusions

Do not add any of the following:

- Angular or Laravel;
- microservices;
- GraphQL;
- WebSocket unless a documented technical blocker makes SSE impossible;
- audio, speech-to-text, video, avatar, face or emotion analysis;
- CV upload;
- social login;
- Monaco Editor;
- code execution, sandbox containers, or coding interview;
- fine-tuning or a vector database;
- admin catalogue CRUD, admin analytics, or password reset in this initial P0 codebase run;
- unverified AI-generated resource URLs;
- paid external services as a requirement for local development or CI.

### 15. Execution protocol

Work autonomously and make actual repository changes.

1. Inspect the repository, Git state, available runtimes, and existing files before writing.
2. Present a short implementation plan and the assumptions you are making.
3. Scaffold in small, coherent steps.
4. After every major step, run the relevant formatting, lint, type-check, test, migration, and build commands. Fix failures before continuing.
5. Do not delete user work or use destructive Git commands.
6. Do not commit, push, or open a pull request unless explicitly authorized.
7. Do not leave critical-path implementations as pseudocode, `TODO`, `any`, disabled tests, or fake-success responses.
8. If a required tool is unavailable, use the nearest maintainable alternative, explain the difference, and keep the architecture invariant.
9. Ask a question only if blocked by an irreversible or materially scope-changing decision. Otherwise choose a sensible default and document it.
10. Keep all changes inside the current repository.

### 16. Final verification and response

Before declaring success, verify from a clean setup as far as the environment allows:

- `pnpm install --frozen-lockfile`
- formatting check
- lint
- type-check
- backend and frontend tests
- production builds
- Prisma schema validation and migration/seed path
- Docker Compose configuration validation
- the Mock AI vertical slice
- no committed secrets

Your final response must include:

1. A concise summary of what was created.
2. The final repository tree, limited to meaningful files and directories.
3. The architecture and security decisions made.
4. Exact commands to run the project from a fresh clone.
5. Exact commands used for verification and whether each passed.
6. Any remaining limitations, with no claim that an unfinished feature works.
7. A recommended next implementation order for the rest of P0: complete all five turns, final result, learning path/regeneration, history, and admin soft-lock UI.

Begin by inspecting the repository and proposing the short execution plan. Then implement the codebase; do not stop after merely describing it.

## PROMPT END

---

## Recommended usage

1. Open the empty repository in Antigravity.
2. Ensure Docker, Node.js, and pnpm are available.
3. Paste the full prompt from `PROMPT START` through `PROMPT END`.
4. Let Antigravity finish the initial inspection and plan before approving terminal actions.
5. Do not ask it to implement the remaining screens until all verification commands in section 16 pass.
