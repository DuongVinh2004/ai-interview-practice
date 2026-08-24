# Acceptance criteria

## End-to-end MVP

Given một candidate đã xác thực, khi chọn Backend/Junior/Node.js/Việt và bắt đầu phiên, thì hệ thống:

1. Tạo đúng một session dù request retry.
2. Sinh đúng số câu theo blueprint hoặc trả trạng thái recoverable.
3. Không chặn HTTP request trong toàn bộ thời gian gọi AI.
4. Cho phép lưu và submit answer an toàn.
5. Tạo một evaluation run immutable.
6. Hiển thị rubric score, evidence, confidence và feedback.
7. Cập nhật lịch sử/learning plan mà không double count.

## Security

- User A không đọc/sửa session, answer, report hoặc share grant của User B bằng cách đổi ID.
- Admin chưa MFA không được vào chức năng quản trị.
- Refresh token replay bị chặn và session liên quan được xử lý theo policy.
- Log và error response không chứa secret hay transcript.

## AI quality

- Mọi output invalid schema bị reject/fallback.
- Mọi feedback claim có evidence hoặc `insufficient_evidence`.
- Thay model/prompt/rubric phải chạy regression eval và so với baseline.
- Bias/fairness slice Việt–Anh được báo cáo, không che giấu sample size.

## Operations

- Deploy có health/readiness, migration gate và rollback.
- Backup restore drill có bằng chứng.
- Alert có owner/runbook và không dựa duy nhất vào CPU.
