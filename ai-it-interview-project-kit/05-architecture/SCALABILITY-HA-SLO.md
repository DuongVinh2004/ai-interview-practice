# Scalability, high availability and SLO

## Launch capacity assumptions

- 10.000 MAU.
- 500 text interview sessions đồng thời.
- 50 AI jobs đồng thời, giới hạn thêm theo provider quota.
- 100 API RPS sustained, 300 RPS burst trong 60 giây.

Đây là target khởi đầu phải được xác nhận bằng load test; không phải forecast kinh doanh.

## Scaling

- API scale theo CPU, RPS và latency.
- Worker scale theo queue depth, oldest-job age, provider rate/cost budget.
- Pool connection có budget theo tổng replicas.
- Redis queue có retention và cleanup; không giữ result vô hạn.
- PostgreSQL index theo access pattern; read replica chỉ thêm khi có query evidence.

## SLO

| Capability          | SLI                          | Target                             |
| ------------------- | ---------------------------- | ---------------------------------- |
| Core REST API       | successful eligible requests | 99,9%/tháng                        |
| Session creation    | p95 latency                  | < 300 ms không tính enqueue outage |
| Answer durability   | accepted answer persisted    | 99,99%                             |
| Question generation | completed within 15 s        | ≥ 95%                              |
| Evaluation          | completed within 20 s        | ≥ 95%                              |
| SSE freshness       | event delivered within 2 s   | ≥ 99% khi connected                |

AI provider failure không được tính như API đã thành công nếu user không nhận được trạng thái recoverable. Error budget phải chặn rollout rủi ro khi burn rate vượt ngưỡng.
