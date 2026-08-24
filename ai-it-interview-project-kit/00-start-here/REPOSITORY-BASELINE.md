# Repository baseline

## Nguồn chính thức

- Remote: `https://github.com/DuongVinh2004/ai-interview-practice.git`
- Baseline kiểm kê: `main@1a66615416e2ea2471951639e1b25b8b12c75f9a`
- Ngày kiểm kê: 2026-08-23
- Phạm vi nguồn: repository public và được người dùng chỉ định làm nguồn duy nhất cho đoạn chat này.

Baseline phải được Codex kiểm tra lại trước mỗi lần triển khai vì branch, commit, PR và issue là dữ liệu động.

## Current state đã xác minh

- Monorepo `pnpm` với `apps/api`, `apps/web` và shared packages.
- Backend NestJS 11 modular monolith; PostgreSQL 16, Prisma 6, Redis 7 và BullMQ worker.
- Frontend React 18, Vite, TypeScript, Tailwind, TanStack Query, React Hook Form và Zustand.
- Shared Zod contracts cho auth, taxonomy, interview, AI, evaluation, learning path và admin.
- Modules hiện có: auth, profile, taxonomy, interview, AI orchestrator, evaluation, learning path, history/report, admin và platform.
- Prisma schema có user, refresh token, profile, taxonomy, session, turn, answer/evaluation, prompt, AI run, learning path, audit và idempotency.
- Có state machine session: `CREATED`, `ACTIVE`, `EVALUATING`, `COMPLETED`, `CANCELLED`, `FAILED`.
- Có provider abstraction, deterministic mock provider, external provider adapter, prompt registry và Zod validation output.
- Có BullMQ processors, answer-before-enqueue invariant, deterministic job concept, SSE và polling fallback.
- Có unit, integration skeleton, frontend tests và Playwright happy path.
- CI chạy format, lint, type-check, Prisma deploy/seed, tests và build với PostgreSQL/Redis service.
- Có Docker Compose, Nginx và ADR 0001–0004.
- Remote chỉ có `main` và Dependabot branches tại thời điểm kiểm kê; chưa có `develop`.

## Khoảng cách chính tới target state

- External AI provider và production provider policy cần kiểm chứng/hoàn thiện; provider chính vẫn là decision gate.
- Chưa có golden set, quality regression pipeline, score calibration, fairness slices và release gate cho model/prompt.
- Evaluation cần rubric version rõ, evidence span, confidence và immutable re-evaluation runs đầy đủ.
- Auth có rotation cơ bản nhưng cần session-family/replay hardening, rate limit, email verification, reset password và MFA admin.
- Admin/support least privilege và audit redaction cần threat-model-driven tests.
- Chưa có bằng chứng migration history trong cây baseline dù CI gọi `prisma migrate deploy`; cần xác minh trước release.
- Test hiện có chưa chứng minh coverage cho ownership/BOLA, concurrency, job retry, provider failure, backup/restore và performance.
- IaC cloud, staging/production topology, SLO alerts, DR drill và secret manager chưa hoàn chỉnh.
- Voice interview, consent, audio lifecycle và accessibility chưa có.
- README dùng cụm “production-grade”; mỗi khả năng vẫn phải được chứng minh bằng test/evidence thay vì tin theo mô tả.

## Nguyên tắc migration

- Giữ NestJS/PostgreSQL/Prisma/Redis/BullMQ/React và pnpm workspaces nếu chưa có ADR được duyệt.
- Tiếp tục modular monolith; chỉ tách service khi có bằng chứng scale, ownership, security boundary hoặc release cadence.
- Giữ mock provider deterministic cho dev/CI và benchmark.
- Nâng cấp schema bằng migration backward-compatible, deploy theo expand/migrate/contract.
- Mỗi thay đổi queue/event phải có idempotency, retry, dead-letter/recovery và compatibility.
- Không sửa lịch sử hoặc tuyên bố hoàn tất nếu evidence thiếu.
