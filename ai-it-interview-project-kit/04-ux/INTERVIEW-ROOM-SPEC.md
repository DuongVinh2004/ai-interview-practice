# Interview room specification

## Layout

- Header: progress, connection/save state, timer nếu blueprint có.
- Question panel: content, code block, clarifying constraint được phép.
- Answer editor: text area/code editor tùy format, autosave status.
- Navigation: previous/next, unanswered marker, review flag.
- Submit: summary và explicit confirmation.

## Behavior

- Autosave debounce + idempotency; offline state không giả vờ đã lưu.
- Keyboard usable hoàn toàn.
- Timer dựa server deadline; client chỉ hiển thị.
- Không mất answer khi refresh hoặc transient failure.
- AI follow-up chỉ xuất hiện khi feature flag bật và audit được.
- Không hiển thị điểm cho đến khi evaluation hoàn tất.

## Error states

- Generation pending: cho rời trang và quay lại.
- Provider delayed: thông báo trung thực, không tạo duplicate.
- Evaluation failed: giữ answer, cho retry theo policy.
- Unauthorized/not found: cùng response shape để giảm enumeration.
