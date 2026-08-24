# Success metrics

## Product

- Activation: hoàn tất phiên đầu trong 24 giờ.
- Completion: tỷ lệ session bắt đầu đi đến kết quả.
- Learning loop: tỷ lệ user quay lại luyện competency yếu trong 7 ngày.
- Improvement: thay đổi điểm chuẩn hóa trên cùng competency/rubric version.
- Feedback usefulness: tỷ lệ phản hồi được user đánh dấu hữu ích.

## AI quality

- Question relevance ≥ 90% trên golden set.
- Difficulty agreement với reviewer ≥ 85%.
- Score agreement: weighted kappa hoặc ICC đạt ngưỡng được phê duyệt.
- Evidence precision ≥ 90%.
- Unsupported feedback rate < 2%.
- Prompt-injection success rate trên adversarial set = 0 cho hành vi cấm.
- Fairness gap giữa nhóm ngôn ngữ trong giới hạn được phê duyệt.

## Engineering

- Availability SLO 99,9% cho API cốt lõi.
- API p95 < 300 ms, không tính external AI job.
- Crash-free interview completion ≥ 99,5%.
- Change failure rate < 10%; MTTR < 60 phút.
- Cost mỗi completed interview nằm trong budget đã chốt.
