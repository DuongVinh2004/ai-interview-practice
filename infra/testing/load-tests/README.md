# AI Interview Practice - Performance & Load Testing Suite

Bộ kịch bản kiểm thử hiệu năng và ngưỡng tải thực nghiệm theo tiêu chuẩn Production SLO.

## Mục tiêu kiểm thử (Production SLO Thresholds)

- **p95 Latency**: <= 800ms cho mọi HTTP API requests (`HighHttpLatencyP95` alert threshold).
- **p99 Latency**: <= 2000ms.
- **Error Rate**: < 1.0% (`HighHttp5xxErrorRate` alert threshold).
- **Concurrent Capacity**: Xác nhận hệ thống ổn định với 100 VUs liên tục và chịu được xung nhịp đột biến 200 VUs.

## Kịch bản kiểm thử (`interview-flow-load-test.js`)

Mô phỏng chu trình phỏng vấn chuẩn của ứng viên:

1. `GET /api/v1/health/live`: Healthcheck liveness probe.
2. `POST /api/v1/auth/login`: Xác thực và nhận JWT bearer token.
3. `POST /api/v1/interviews`: Tạo session phỏng vấn kèm `Idempotency-Key` (bảo vệ chống trùng lặp).
4. `GET /api/v1/interviews/:id`: Tải chi tiết phiên phỏng vấn và câu hỏi khởi tạo.
5. `POST /api/v1/interviews/:id/answers`: Nộp câu trả lời text cho turn hiện tại.
6. `GET /api/v1/interviews/:id/status`: Polling trạng thái xử lý nhẹ.

## Các giai đoạn tải (Stages)

1. **Ramp-up (30s)**: 0 -> 50 VUs (Khởi động hệ thống).
2. **Ramp-up (1m)**: 50 -> 100 VUs.
3. **Plateau (2m)**: Duy trì 100 VUs liên tục (Expected Peak Traffic).
4. **Spike (30s)**: Đột biến lên 200 VUs (Traffic Burst).
5. **Ramp-down (30s)**: Giảm về 0 VUs (Kiểm tra rò rỉ tài nguyên, giải phóng pool).

## Hướng dẫn thực thi

### Cài đặt k6

```bash
# Windows (winget hoặc choco)
winget install k6 --source winget
# hoặc macOS (Homebrew)
brew install k6
# hoặc Linux (Debian/Ubuntu)
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

### Chạy test trên Local / Staging

```bash
# Chạy với default endpoint (http://localhost:3001/api/v1)
k6 run infra/testing/load-tests/interview-flow-load-test.js

# Chạy với môi trường Staging / Custom Endpoint
k6 run \
  -e BASE_URL="https://staging.ai-interview.dev/api/v1" \
  -e DEMO_CANDIDATE_EMAIL="candidate@example.com" \
  -e DEMO_CANDIDATE_PASSWORD="Candidate@123456" \
  infra/testing/load-tests/interview-flow-load-test.js
```
