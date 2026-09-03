# Disaster Recovery Restore Drill Evidence Archive

Thư mục này lưu trữ các file chứng cứ diễn tập phục hồi dữ liệu thực tế (`restore-drill-<epoch>.json`) được sinh tự động bởi script [infra/scripts/restore-drill.sh](../../infra/scripts/restore-drill.sh).

## Cấu trúc file chứng cứ chuẩn (Standard Evidence Schema)

```json
{
  "startedAt": "2026-09-03T10:00:00Z",
  "targetDatabase": "ai_interview_restore_drill_20260903",
  "backupFile": "artifacts/backups/postgres/ai_interview_20260903.dump.enc",
  "sourceRecoveryPointUtc": "2026-09-03T09:50:00Z",
  "tableCount": 42,
  "invalidConstraints": 0,
  "rpoSeconds": 600,
  "rpoTargetSeconds": 900,
  "rpoStatus": "PASS",
  "rtoSeconds": 180,
  "rtoTargetSeconds": 3600,
  "rtoStatus": "PASS"
}
```

## Điều kiện Go-Live (Production Gate)

- `rpoStatus` bắt buộc phải là `"PASS"` (RPO <= 15 phút).
- `rtoStatus` bắt buộc phải là `"PASS"` (RTO <= 60 phút).
- `invalidConstraints` bắt buộc phải bằng `0`.
- Toàn bộ 6 bảng trọng yếu (`users`, `interview_sessions`, `interview_turns`, `evaluations`, `evaluation_runs`, `audit_logs`) phải hiện diện đầy đủ sau khi restore.
