# Evaluation and feedback

## Score model

Mỗi câu được chấm theo rubric dimensions, ví dụ:

- Technical correctness: 0–4.
- Completeness: 0–4.
- Reasoning and trade-offs: 0–4.
- Clarity: 0–4.
- Practical example: 0–2.

Điểm tổng là phép tính deterministic từ dimension scores và weights. LLM chỉ đề xuất dimension score, evidence và rationale theo schema.

## Invariants

- Mọi nhận xét tiêu cực/tích cực có evidence span hoặc cờ `insufficient_evidence`.
- Không dùng tên, tuổi, giới tính, giọng, accent hoặc thông tin hồ sơ không liên quan để chấm.
- Evaluation lưu model, prompt, rubric, schema và dataset version.
- Low confidence hoặc schema violation chuyển `REVIEW_REQUIRED`/fallback, không tự bịa điểm.
- Re-evaluation tạo run mới; không overwrite lịch sử.

## Feedback contract

- Tóm tắt điểm mạnh.
- Khoảng trống cụ thể.
- Câu trả lời mẫu ngắn, không khẳng định là đáp án duy nhất.
- Bài luyện tiếp theo.
- Confidence và limitation.
