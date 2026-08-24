# SSE and polling contract

## SSE

- Authenticated stream scoped đúng session owner/admin policy.
- Event có monotonic/event ID, type, session ID, occurredAt và version.
- Client gửi `Last-Event-ID` khi reconnect nếu server hỗ trợ replay.
- Heartbeat giữ connection và phát hiện stale.
- Nginx tắt buffering cho SSE như ADR hiện có.

## Polling fallback

- `/interviews/:id/status` trả snapshot đủ để recover UI.
- ETag/updatedAt hỗ trợ conditional request.
- Backoff + jitter, dừng khi terminal state.
- SSE/polling không tạo domain mutation.

Event mất không được làm sai state; database snapshot là source of truth.
