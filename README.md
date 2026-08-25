# AI Interview Practice 🚀

Production-grade modular monolith and client application for interactive IT mock technical interviews with real-time AI evaluation, adaptive difficulty, and personalized learning path roadmaps.

---

## 🌟 Key Architecture & Highlights

- **Monorepo**: Plain `pnpm` workspaces.
- **Backend**: **NestJS Modular Monolith** with explicit domain boundaries (`auth`, `profile`, `taxonomy`, `interview`, `ai-orchestrator`, `evaluation`, `learning-path`, `history-report`, `admin`, `platform`).
- **Frontend**: **React 18 + Vite + TypeScript + Tailwind CSS** with TanStack Query, React Hook Form, Zod, and minimal Zustand client state.
- **Database & Cache**: PostgreSQL with Prisma ORM & Redis with BullMQ queues.
- **Real-Time Delivery**: Server-Sent Events (SSE) with seamless REST polling fallback (`/interviews/:id/status`).
- **AI Strategy**: Provider abstraction layer featuring deterministic `MockAiProvider` (zero cost / zero external dependency for dev & CI) and `ExternalAiProvider`.
- **Reliability & Idempotency**: Answer persistence before queue enqueue, deterministic job IDs, and `Idempotency-Key` HTTP header support.

---

## 📁 Repository Structure

```text
ai-interview-practice/
├── apps/
│   ├── api/                     # NestJS API & BullMQ Worker
│   │   ├── prisma/              # Schema, migrations, idempotent seed
│   │   └── src/                 # Modular monolith domain packages
│   └── web/                     # React 18 / Vite frontend
├── packages/
│   ├── contracts/               # Shared Zod schemas, TypeScript types, Enums
│   ├── eslint-config/           # Shared ESLint configuration
│   └── tsconfig/                # Shared TypeScript compiler options
├── infra/
│   └── nginx/                   # Nginx reverse proxy configuration
├── docs/
│   ├── adr/                     # Architecture Decision Records (ADRs 0001-0004)
│   ├── architecture.md          # Architecture specs & sequence diagrams
│   └── api-conventions.md       # API error handling & envelope standards
├── docker-compose.yml           # Local multi-container environment
├── pnpm-workspace.yaml
└── README.md
```

---

## ⚡ Quickstart: Running from Fresh Clone

### Prerequisites

- Node.js >= 20.x
- pnpm >= 9.x (`corepack enable && corepack prepare pnpm@11.0.9 --activate`)
- Docker & Docker Compose

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

### 3. Start Database & Redis via Docker

```bash
docker compose up -d postgres redis
```

### 4. Run Migrations & Idempotent Seed

```bash
pnpm db:migrate
pnpm db:seed
```

> **Demo Accounts**: Set environment variables before seeding:
> ```bash
> export DEMO_ADMIN_EMAIL=admin@yourorg.com
> export DEMO_ADMIN_PASSWORD=$(openssl rand -base64 24)
> export DEMO_CANDIDATE_EMAIL=candidate@yourorg.com
> export DEMO_CANDIDATE_PASSWORD=$(openssl rand -base64 24)
> pnpm db:seed
> ```

### 5. Start Development Servers

In separate terminals or concurrently:

```bash
# Start API & Web concurrently
pnpm dev

# Or run separately:
pnpm dev:api       # Runs on http://localhost:3001
pnpm dev:worker    # Runs BullMQ background worker
pnpm dev:web       # Runs on http://localhost:5173
```

---

## 📚 API Documentation (OpenAPI / Swagger)

Interactive Swagger documentation is available at:
👉 **`http://localhost:3001/api/docs`**

---

## 🧪 Testing Baseline

```bash
# 1. Run unit tests across all packages
pnpm test

# 2. Run backend Supertest integration tests
pnpm --filter api test:integration

# 3. Run frontend Vitest tests
pnpm --filter web test

# 4. Run Playwright E2E happy path test
pnpm --filter web test:e2e
```

---

## 🛠️ Common Troubleshooting

- **PostgreSQL Connection Refused**: Verify docker container is healthy: `docker compose ps`. Ensure `DATABASE_URL` matches your local port.
- **BullMQ / Redis Connection Refused**: Verify Redis container is running on port 6379: `docker exec -it ai_interview_redis redis-cli ping`.
- **SSE Connection Disconnected**: Verify reverse proxy buffer is disabled (`proxy_buffering off;`). The frontend will automatically fall back to polling `/interviews/:id/status`.

---

## 📄 Architecture Decision Records (ADRs)

- [ADR 0001: Modular Monolith Architecture](docs/adr/0001-modular-monolith-architecture.md)
- [ADR 0002: Server-Sent Events with REST Polling Fallback](docs/adr/0002-server-sent-events-with-polling-fallback.md)
- [ADR 0003: AI Provider Abstraction & Mock Strategy](docs/adr/0003-ai-provider-abstraction.md)
- [ADR 0004: Answer Persistence Prior to Async Enqueue](docs/adr/0004-answer-persistence-before-enqueue.md)
