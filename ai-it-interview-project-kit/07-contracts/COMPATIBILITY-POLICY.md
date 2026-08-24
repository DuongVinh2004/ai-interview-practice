# Compatibility policy

- Shared Zod schema là contract runtime; frontend/backend cùng version nhưng deploy có thể lệch thời gian.
- Thêm optional field là backward-compatible; đổi enum/required field cần version hoặc two-phase rollout.
- API breaking change cần `/v2` hoặc negotiated deprecation.
- Queue payload có `version`; worker hỗ trợ version cũ đến khi queue drain.
- Database migration theo expand/contract.
- Prompt/rubric/model version không overwrite lịch sử.
- SSE client bỏ qua field/type chưa biết nhưng không bỏ qua terminal state không hiểu.

Contract tests chạy producer và consumer fixtures trong CI.
