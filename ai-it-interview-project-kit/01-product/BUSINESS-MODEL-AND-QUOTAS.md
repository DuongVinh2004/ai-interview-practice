# Business model and quotas

## Đề xuất

- Free: số phiên/tháng giới hạn, text only, lịch sử 30 ngày.
- Pro: quota cao hơn, lịch sử dài, learning plan nâng cao và voice khi có.
- Education: lớp/mentor, chỉ sau khi hoàn thiện consent và tenant boundary.

## Quota dimensions

- Interview sessions.
- Generated questions.
- Evaluation tokens/cost units.
- Voice minutes.
- Retained audio/transcript storage.

Quota check phải atomic, idempotent và có audit. Không trừ quota hai lần khi retry. Billing/payment provider là decision gate.
