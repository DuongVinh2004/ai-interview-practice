# Migration and compatibility

## Expand/migrate/contract

1. Expand: thêm nullable column/table/index concurrent-safe.
2. Deploy code dual-read/write nếu cần.
3. Backfill theo batch có checkpoint/metrics.
4. Chuyển read path qua feature flag.
5. Verify counts, constraints và performance.
6. Contract: xóa old field sau deprecation window và backup.

## Rules

- Commit Prisma migration files; không chỉ sửa `schema.prisma`.
- `prisma migrate deploy` phải chạy được từ fresh production-like database.
- Seed production-safe và idempotent; demo password không dùng production.
- Migration có forward/rollback strategy; destructive migration cần backup/restore evidence.
- Worker payload cũ trong Redis phải còn được xử lý hoặc drain trước deploy.
