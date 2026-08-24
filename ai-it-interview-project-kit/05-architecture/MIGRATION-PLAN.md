# Current-to-target migration plan

## Không rewrite

Giữ monorepo, shared contracts, NestJS modules, Prisma schema, BullMQ, SSE/polling, mock provider, React routes, CI và ADR hiện có.

## Harden trước mở rộng

1. Chạy baseline verification từ fresh clone và sửa mismatch docs/scripts.
2. Hoàn thiện migration history, auth/session security và ownership tests.
3. Thêm MFA admin, email verification/reset và rate-limit evidence.
4. Version rubric/evaluation run và sửa mock evaluator không chấm theo độ dài thuần túy.
5. Tạo golden set + AI eval pipeline trước external provider.
6. Thêm recovery cho DB-persist/enqueue gap và failed job operations.
7. Hoàn thiện observability, SLO, backup/restore và deployment gate.
8. Sau đó mới bật provider thật canary và mở rộng voice.

Mỗi bước phải backward-compatible, có feature flag khi phù hợp và không làm mất session/answer hiện hữu.
