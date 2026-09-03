# 🎯 AI IT Interview Practice Platform

[![CI Pipeline](https://github.com/DuongVinh2004/ai-interview-practice/actions/workflows/ci.yml/badge.svg)](https://github.com/DuongVinh2004/ai-interview-practice/actions/workflows/ci.yml)
[![Security & Compliance](https://github.com/DuongVinh2004/ai-interview-practice/actions/workflows/security.yml/badge.svg)](https://github.com/DuongVinh2004/ai-interview-practice/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.13.x-green.svg?logo=nodedotjs)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-11.x-orange.svg?logo=pnpm)](https://pnpm.io/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg?logo=nestjs)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4+-38bdf8.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ed.svg?logo=docker)](https://www.docker.com/)
[![Terraform](https://img.shields.io/badge/Terraform-AWS%20ECS-844fba.svg?logo=terraform)](https://www.terraform.io/)

> **An enterprise-grade, full-spectrum AI technical interview simulation and assessment engine.**
> Delivers real-time multimodal evaluation, low-latency voice streaming, sandbox code execution, collaborative system design canvas, adaptive behavioral follow-ups, competitive engineering arena challenges, and institutional B2B hiring analytics.

---

## 📑 Table of Contents

- [Architectural Overview](#-architectural-overview)
- [Flagship Features](#-flagship-features)
  - [1. Real-Time Low-Latency Voice Interview (F001)](#1-real-time-low-latency-voice-interview-f001)
  - [2. Live Coding Sandbox & Grading (F002)](#2-live-coding-sandbox--grading-f002)
  - [3. Interactive System Design Whiteboard (F003)](#3-interactive-system-design-whiteboard-f003)
  - [4. Behavioral STAR Interview Engine (F007)](#4-behavioral-star-interview-engine-f007)
  - [5. Engineering Arena & Forensic Anti-Cheat (F017)](#5-engineering-arena--forensic-anti-cheat-f017)
  - [6. Adaptive Learning & FSRS Flashcards (F005, F006, F008)](#6-adaptive-learning--fsrs-flashcards-f005-f006-f008)
  - [7. B2B Multi-Tenant Hiring & Cohort Analytics (F011)](#7-b2b-multi-tenant-hiring--cohort-analytics-f011)
- [AI Orchestration & Safety Invariants](#-ai-orchestration--safety-invariants)
- [Security, Privacy & Compliance](#-security-privacy--compliance)
- [Enterprise Reliability & SRE Verification](#-enterprise-reliability--sre-verification)
- [Repository Structure](#-repository-structure)
- [Getting Started](#-getting-started)
- [Testing & Quality Verification](#-testing--quality-verification)
- [Architecture Decision Records (ADRs)](#-architecture-decision-records-adrs)

---

## 🏛️ Architectural Overview

The platform is designed as a **clean modular monolith** with strict domain boundaries, backed by an event-driven BullMQ queue system, Server-Sent Events (SSE) for real-time client push, and multi-cloud resilience abstractions.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Browser Client (React 18 + Vite)                       │
│      [Voice Streaming]      [Code Editor]      [System Design Canvas]      [Arena IDE] │
│      WebSocket / PCM16      Monaco / Judge0      Excalidraw / SVG Canvas    Multi-File │
└────────────────────────┬───────────────────────────────────────┬───────────────────────┘
                         │ HTTPS / REST (Zod Contracts)          │ WebSocket (8kHz/16kHz)
                         ▼                                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 NestJS Modular Monolith API                            │
│                                                                                        │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │   Auth & Security    │  │  Interview Lifecycle │  │     Engineering Arena        │  │
│  │  • TOTP MFA Step-Up  │  │  • FSM State Machine │  │  • Multi-file Workspace      │  │
│  │  • Token Family Rot. │  │  • Optimistic CAS    │  │  • Git Patch Validator       │  │
│  │  • BOLA / IDOR Guard │  │  • Idempotency-Key   │  │  • Anti-Cheat Telemetry      │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────────────┘  │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                         AI Orchestration & FinOps Layer                          │  │
│  │  • Multi-LLM Cascade: Google Gemini ➔ OpenAI GPT-4o ➔ Anthropic Claude           │  │
│  │  • Circuit Breakers (Cooldown & Half-Open Probes)                                │  │
│  │  • Distributed Redis Lua Budget Enforcer ($50 daily, $2/call ceiling)            │  │
│  │  • Anti-Hallucination Verbatim Quote Verifier (Mandatory Evidence Invariant)     │  │
│  │  • Semantic Embedding Cache & Prompt Injection Defense                           │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                           Storage & Transport Adapters                           │  │
│  │  • Database: PostgreSQL 16 (Prisma ORM, 15 Migrations, 104 Relational Models)    │  │
│  │  • Queues & Cache: Redis 7.4 + BullMQ (Deterministic Job Deduplication)          │  │
│  │  • Real-Time: Cross-Process SSE Bus (Redis Pub/Sub) + Polling Fallback           │  │
│  │  • Telemetry: Isolated Prometheus Port (9091) + Bearer Auth                      │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌟 Flagship Features

### 1. Real-Time Low-Latency Voice Interview ([F001](docs/features/F001-VOICE-REALTIME-INTERVIEW.md))

- **Multimodal Audio Streaming**: Full-duplex WebSocket communication streaming PCM16 audio chunks (20ms frames at 16kHz).
- **Voice Activity Detection (VAD)**: Real-time energy-based silence detection with automatic barge-in interruption handling.
- **Provider Cascade**: Deepgram Nova-2 STT paired with ElevenLabs TTS, featuring a deterministic zero-cost mock voice provider for local CI/CD pipelines.

### 2. Live Coding Sandbox & Grading ([F002](docs/features/F002-LIVE-CODING-SANDBOX.md))

- **Monaco Code Editor**: Syntax highlighting, auto-completion, and multi-language support (TypeScript, Python, Java, Go, C++).
- **Execution Sandbox**: Judge0 container integration with strict CPU/memory timebox isolation and zero-secret network sandbox guards.
- **Deterministic Evaluation**: Automated test suite assertion runner comparing outputs against hidden test cases and algorithmic complexity benchmarks.

### 3. Interactive System Design Whiteboard ([F003](docs/features/F003-SYSTEM-DESIGN-WHITEBOARD.md))

- **Excalidraw Canvas**: Real-time diagramming environment supporting distributed system components (microservices, message queues, caches, load balancers, databases).
- **Vision AI Assessment**: Evaluates exported canvas snapshots against architectural criteria (high availability, partitioning, throughput, latency, SPOF detection).

### 4. Behavioral STAR Interview Engine ([F007](docs/features/F007-BEHAVIORAL-STAR-INTERVIEW.md))

- **STAR Rubric Alignment**: Analyzes responses against **Situation, Task, Action, Result** structured criteria.
- **Dynamic Probing**: Detects evasive, generic, or AI-generated answers and generates targeted contextual follow-up questions to uncover specific candidate contributions.

### 5. Engineering Arena & Forensic Anti-Cheat ([F017](docs/features/F017-ENGINEERING-ARENA.md))

- **Real-World Engineering Challenges**: Candidates debug, refactor, and implement features across real multi-file repositories.
- **Automated Patch Grading**: Generates Git unified diffs, runs test suites against modified workspaces, and calculates exact pass rates.
- **Forensic Anti-Cheat Telemetry**: Captures keystroke flight time, paste burst anomalies, blur/tab-switch counts, and computes risk scores (0–100).

### 6. Adaptive Learning & FSRS Flashcards ([F005](docs/features/F005-SPACED-REPETITION-FLASHCARDS.md), [F006](docs/features/F006-SOCRATIC-AI-TUTOR.md), [F008](docs/features/F008-SKILL-GRAPH-BENCHMARK.md))

- **FSRS-4.5 Algorithm**: Free Spaced Repetition Scheduler optimizes review intervals based on memory stability and difficulty ratings.
- **Socratic AI Tutor**: Interactive step-by-step mentor providing targeted hints without giving away the complete solution.
- **Skill Graph & Readiness Index**: Dynamic weighted radar score across CS fundamentals, system design, coding velocity, and communication.
- **Verified Portfolio Certificates ([F010](docs/features/F010-VERIFIED-PORTFOLIO-CERTIFICATE.md))**: Cryptographically signed SHA-256 completion badges for candidate portfolios.

### 7. B2B Multi-Tenant Hiring & Cohort Analytics ([F011](docs/features/F011-B2B-MULTI-TENANT.md))

- **Multi-Tenant Isolation**: Hardened tenant context boundaries preventing cross-tenant data leakage with fail-closed security guards.
- **Cohort Benchmarking**: Enterprise candidate ranking, skill gap distributions, interview velocity metrics, and automated PDF/CSV report exports.

---

## 🛡️ AI Orchestration & Safety Invariants

| Security / Safety Layer      | Implementation Mechanism                                          | Production Invariant                                                               |
| ---------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Multi-Provider Cascade**   | `ProviderRouterService` (Gemini ➔ OpenAI ➔ Anthropic)             | Automatic failover upon 429/5xx errors; zero single-point-of-failure               |
| **Circuit Breakers**         | Configurable failure thresholds (5 failures / 60s window)         | Automatic trip to `OPEN`, 30s cooldown, probe in `HALF_OPEN`                       |
| **FinOps Cost Guards**       | Atomic Redis Lua script (`DistributedBudgetService`)              | Hard $50.00 daily budget cap and $2.00 max per-call threshold                      |
| **Anti-Hallucination Gate**  | Exact verbatim substring verification (`AiSecurityFilterService`) | Scores cannot be saved if cited evidence quotes do not exist in candidate answer   |
| **Authoritative Invariant**  | `EvaluationAuthorityValidator`                                    | Strict production guard: mock provider outputs cannot finalize production sessions |
| **Prompt Injection Defense** | Regex + behavioral pattern analyzer                               | Intercepts instruction override attacks, trait extraction, and spam stuffing       |

---

## 🔒 Security, Privacy & Compliance

- **Authentication & Token Security**:
  - Dual-token refresh family pattern with automatic reuse detection; revokes the entire family upon token replay attack ([P1-008](docs/adr/0001-modular-monolith-architecture.md)).
  - Time-based One-Time Password (TOTP) MFA with AES-256-GCM encrypted secrets and single-use SHA-256 hashed recovery codes.
  - Step-up authentication guard (`MfaStepUpGuard`) protecting privileged admin routes.
- **Authorization & Data Protection**:
  - Broken Object-Level Authorization (BOLA / IDOR) validation across all session, turn, feedback, and document resources.
  - PII Redaction & Data Sanitization: Automatic phone, email, and address masking prior to sending prompts to external LLMs.
  - Automated GDPR / CCPA right-to-be-forgotten deletion and daily data retention purge cron job.
- **CI/CD Security Scanning**:
  - **Secret Detection**: `Gitleaks` scanning every commit.
  - **SAST**: `Semgrep` enforcing OWASP Top 10 and security-audit rule suites.
  - **Vulnerability & IaC Scan**: `Trivy` scanning dependencies, Dockerfiles, and Terraform configs.

---

## 📈 Enterprise Reliability & SRE Verification

- **Empirical Load Benchmark Evidence**:
  - Multi-stage load benchmark executing **4,500 real HTTP socket requests** across interview endpoints under 200 concurrent virtual users.
  - **Results**: `0.00%` error rate, **p50: 41ms**, **p95: 81ms** (Target: < 800ms), **p99: 123ms** (Target: < 2000ms). Evidence archived at [`artifacts/load-tests/load-test-evidence.json`](artifacts/load-tests/load-test-evidence.json).
- **Disaster Recovery Restore Drill**:
  - Automated drill assembling 15 authoritative Prisma migrations (112 KB DDL), performing AES-256-CBC PBKDF2 (200,000 iter) encryption, bit-level reversibility verification, and relational constraint validation across **104 tables** and **120 foreign keys**.
  - **Recovery SLOs**: **RTO: 1s** (Target: < 3600s), **RPO: 300s** (Target: < 900s), `0` invalid constraints. Evidence archived at [`artifacts/restore-drill/`](artifacts/restore-drill/).
- **Terraform IaC**:
  - Complete AWS ECS Fargate infrastructure modules with Application Load Balancer, private VPC subnets, EventBridge automated nightly backup task rules, S3 snapshot encryption, and KMS key management.

---

## 📂 Repository Structure

```text
ai-interview-practice/
├── apps/
│   ├── api/                          # NestJS Modular Monolith API
│   │   ├── prisma/                   # Schema (104 models), 15 migrations, seed
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/             # JWT, TOTP MFA, Refresh Families, Guards
│   │   │   │   ├── ai-orchestrator/  # Router, Circuit Breaker, FinOps, Filters
│   │   │   │   ├── interview/        # FSM State Machine, Turns, Submissions
│   │   │   │   ├── voice-gateway/    # WebSocket Gateway, VAD, STT/TTS Providers
│   │   │   │   ├── code-execution/   # Judge0 & Local Sandbox Runtime
│   │   │   │   ├── system-design/    # Canvas, Diagram Review, Vision Provider
│   │   │   │   ├── engineering-arena/# Workspaces, Git Patches, Anti-Cheat
│   │   │   │   ├── flashcards/       # FSRS Spaced Repetition Engine
│   │   │   │   ├── b2b/              # Multi-Tenant Cohorts & Access Policies
│   │   │   │   ├── platform/         # Prisma, Redis, SSE, Telemetry, Metrics
│   │   │   │   └── ...               # Billing, Gamification, Taxonomy, Document Parser
│   │   │   └── worker.ts             # BullMQ Background Evaluation Worker
│   │   └── test/                     # Forensic Audit, E2E Journeys, Eval Suites
│   └── web/                          # React 18 + Vite Frontend Application
│       └── src/
│           ├── features/             # Voice, Code, System Design, Arena, Auth
│           ├── components/           # UI Component Library (Tailwind CSS)
│           └── hooks/                # Voice Streaming, Cloud Upload, Canvas
├── packages/
│   ├── contracts/                    # Single Source of Truth Zod Schemas & Types
│   ├── eslint-config/                # Strict Shared Linting Config
│   └── tsconfig/                     # Shared TypeScript Compiler Configurations
├── infra/
│   ├── terraform/                    # AWS ECS, RDS, Redis, S3, KMS, EventBridge
│   ├── prometheus/                   # Prometheus Scrape Config & Alert Rules
│   └── scripts/                      # Load Benchmark, Restore Drill, Safety Check
└── artifacts/                        # Verified Audit Evidence (k6, Restore Drill)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `22.13.x` (or Node >= 20.x)
- **Package Manager**: `pnpm >= 11.0.0` (`corepack enable && corepack prepare pnpm@11.0.9 --activate`)
- **Docker & Docker Compose**: For local PostgreSQL and Redis containers.

### Quick Start (Local Development)

```bash
# 1. Clone repository
git clone https://github.com/DuongVinh2004/ai-interview-practice.git
cd ai-interview-practice

# 2. Install monorepo dependencies
pnpm install

# 3. Configure environment variables
cp .env.example .env

# 4. Start PostgreSQL and Redis containers
docker compose up -d postgres redis

# 5. Execute database migrations and seed baseline taxonomy
pnpm db:migrate
pnpm db:seed

# 6. Start API, Worker, and Web applications concurrently
pnpm dev
```

App will be available at:

- 🌐 **Web Client**: [http://localhost:5173](http://localhost:5173)
- 🔌 **Backend API**: [http://localhost:3001](http://localhost:3001)
- 📖 **Interactive Swagger / OpenAPI Docs**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- 📊 **Prometheus Metrics**: [http://localhost:9091/metrics](http://localhost:9091/metrics) _(requires `METRICS_AUTH_TOKEN`)_

---

## 🧪 Testing & Quality Verification

```bash
# Verify formatting across entire repository (Prettier)
pnpm format:check

# Run static analysis and linter
pnpm lint

# Run strict TypeScript compiler checks across all workspaces
pnpm type-check

# Run backend test suite (153 suites, 896 tests)
pnpm --filter @ai-interview/api test:unit

# Run frontend Vitest suite
pnpm --filter @ai-interview/web test

# Run real HTTP socket load benchmark (4,500 requests, p95 latency check)
node infra/scripts/run-load-benchmark.mjs

# Run disaster recovery restore drill (cryptographic backup & 104-table schema check)
node infra/scripts/run-restore-drill.mjs

# Verify database migration safety (detect destructive DDL)
node infra/scripts/check-migration-safety.mjs

# Verify release workflow invariants (immutable digests, build-once promotion)
node infra/scripts/check-release-workflows.mjs
```

---

## 📚 Architecture Decision Records (ADRs)

Key architectural decisions are documented in [`docs/adr/`](docs/adr/):

- **[ADR 0001](docs/adr/0001-modular-monolith-architecture.md)**: Modular Monolith Architecture over Microservices
- **[ADR 0002](docs/adr/0002-server-sent-events-with-polling-fallback.md)**: Server-Sent Events with REST Polling Fallback
- **[ADR 0003](docs/adr/0003-ai-provider-abstraction.md)**: AI Provider Abstraction & Zero-Cost Mock Strategy
- **[ADR 0004](docs/adr/0004-answer-persistence-before-enqueue.md)**: Answer Persistence Prior to Async Enqueue
- **[ADR 0005](docs/adr/0005-semantic-cache-vector-store.md)**: Semantic Cache & Vector Store Design
- **[ADR 0008](docs/adr/0008-websocket-gateway-architecture.md)**: WebSocket Low-Latency Audio Streaming Gateway
- **[ADR 0010](docs/adr/0010-engineering-arena-runtime-boundary.md)**: Engineering Arena Isolated Runtime Boundary

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
