# Tổng Hợp Trạng Thái Release Gates & Ops Go-Live

> **Môi trường**: Production Candidate  
> **Repository**: `c:\Users\Duong Vinh\Project\ai-interview-practice`  
> **Thời điểm thẩm định**: 2026-10-27  
> **Trạng thái tổng quan**: **CODE GATES: 100% PASS** | **OPS GATES: PENDING CREDENTIALS & DNS**

---

## 1. Bảng Trạng Thái 12 Release Gates (Code-Level vs Ops Gates)

Dưới đây là chi tiết phân định giữa các cổng kiểm soát tầng mã nguồn (Code-Level) đã nghiệm thu thực tế và các cổng vận hành (Operational Gates) cần thông tin tài khoản thật trước giờ G:

| Gate ID | Tên Release Gate                     | Phân Loại  | Trạng Thái | Bằng Chứng / Ghi Chú Kỹ Thuật                                                                      |
| :------ | :----------------------------------- | :--------: | :--------: | :------------------------------------------------------------------------------------------------- |
| **G1**  | **Type & Contract Safety**           | Code-Level |  **PASS**  | `pnpm type-check` 0 lỗi trên toàn bộ monorepo (contracts, api, web).                               |
| **G2**  | **Identity & Session Auth**          | Code-Level |  **PASS**  | JWT Access (15m) + Refresh (7d) rotation, token revocation blacklist, MFA step-up.                 |
| **G3**  | **Object Authorization (IDOR/BOLA)** | Code-Level |  **PASS**  | Ownership validation trên mọi endpoint Session, Audio recording, Bookmarks.                        |
| **G4**  | **Financial & Quota Integrity**      | Code-Level |  **PASS**  | Webhook Stripe/PayOS idempotent, sổ cái hóa đơn durable `invoice.status=PAID`, quota atomic check. |
| **G5**  | **Safe Data Projection**             | Code-Level |  **PASS**  | Rubric, benchmark criteria và đáp án ẩn trước khi thanh toán / reveal. DTO projection sạch.        |
| **G6**  | **Content Governance Workflow**      | Code-Level |  **PASS**  | State machine câu hỏi 5 bước, tác giả không được tự duyệt bài.                                     |
| **G7**  | **Code Sandbox Security**            | Code-Level |  **PASS**  | Giới hạn CPU/RAM/pids, timeout 10s, chặn network egress và fork bombs trong Arena runner.          |
| **G8**  | **AI Evaluation Fidelity**           | Code-Level |  **PASS**  | Golden dataset benchmark, rubric multi-dimensional scoring cap, fail-closed khi thiếu key.         |
| **G9**  | **Async State & Queue DLQ**          | Code-Level |  **PASS**  | BullMQ retry 3 lần, exponential backoff (delay 1000ms), DLQ retention để kiểm tra lỗi.             |
| **G10** | **Chaos & Fault Tolerance**          | Code-Level |  **PASS**  | Router AI provider fallback (`gemini,openai,anthropic`), circuit breaker, timeout 10s.             |
| **G11** | **Browser E2E, A11y & Resilience**   | Code-Level |  **PASS**  | WCAG 2.2 AA compliant, auto-save draft localStorage, offline banner, SSE/polling fallback.         |
| **G12** | **Git Tree & Work Preservation**     | Code-Level |  **PASS**  | Toàn bộ uncommitted/untracked files được bảo toàn nguyên vẹn. Không force reset.                   |

---

## 2. Trạng Thái Chi Tiết Từng Phân Hệ Go-Live

### 2.1 Stripe Live Mode Readiness

- **Kiểm tra mã nguồn**:
  - `apps/api/src/modules/billing/providers/stripe.provider.ts`: Xác nhận cơ chế **fail-closed** nghiêm ngặt khi thiếu `STRIPE_SECRET_KEY` trong môi trường `production` hoặc `STRIPE_LIVE_MODE=true` (throw `BadRequestException`).
  - `apps/api/src/modules/billing/webhook.controller.ts`: Xác nhận truyền `rawBody` string vào `stripeProvider.handleWebhook`.
  - HMAC-SHA256 signature verification với dung sai timestamp 5 phút (`Math.abs(currentTime - eventTime) > 300`) và `crypto.timingSafeEqual` chống timing attack.
- **Biến môi trường (.env.example)**: Đã cập nhật đầy đủ các biến:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_LIVE_MODE`
  - `STRIPE_PRO_MONTHLY_PRICE_ID`
  - `STRIPE_PRO_YEARLY_PRICE_ID`
  - `STRIPE_PRICE_PRO`
  - `STRIPE_PRICE_TEAM`
  - `STRIPE_PRICE_ENTERPRISE`
- **Kết quả kiểm thử**: Suite `billing` PASS 10/10 test suites (57/57 tests).
- **Hành động Ops còn lại**: Đăng ký Stripe Live Account, cấu hình Webhook Endpoint trên Dashboard và nhập `sk_live_...`, `whsec_...`.

### 2.2 PayOS VietQR Readiness

- **Kiểm tra mã nguồn**:
  - `apps/api/src/modules/billing/providers/payos.provider.ts`: Xác nhận cơ chế **fail-closed** khi chạy production mà thiếu credentials hoặc dùng mock keys (throw `DomainException` HTTP 503 `SERVICE_UNAVAILABLE`).
  - Webhook callback xác thực checksum mật mã HMAC-SHA256 qua SDK PayOS.
  - Xử lý tính lũy đẳng (Idempotency) dựa trên hóa đơn `PAYOS_<orderCode>`, kiểm tra tính toàn vẹn số tiền (`amountTotal`) và đơn vị tiền tệ (`VND`).
- **Biến môi trường (.env.example)**: Đã có đầy đủ:
  - `PAYOS_CLIENT_ID`
  - `PAYOS_API_KEY`
  - `PAYOS_CHECKSUM_KEY`
- **Kết quả kiểm thử**: Suite `payos-provider.spec.ts` và `payos-webhook.spec.ts` PASS 100%.
- **Hành động Ops còn lại**: Hoàn thiện KYC trên PayOS Portal, tạo kênh thanh toán production, cấu hình webhook callback URL.

### 2.3 Email DNS & Resend Readiness

- **Kiểm tra mã nguồn**:
  - `apps/api/src/modules/email/providers/resend-email.provider.ts`: Khởi tạo SDK Resend, truyền đúng sender domain.
  - `apps/api/src/modules/email/email.service.ts` & `email.processor.ts`: Toàn bộ email được xếp hàng qua BullMQ Queue (`QueueName.EMAIL`) với cấu hình `attempts: 3`, `backoff: { type: 'exponential', delay: 1000 }` (hoặc 2000ms ở cấp RedisModule).
  - 6 mẫu React Email templates render song ngữ chuẩn.
- **Biến môi trường (.env.example)**: Đã bổ sung đầy đủ:
  - `EMAIL_PROVIDER=resend`
  - `RESEND_API_KEY=`
  - `RESEND_FROM_EMAIL=noreply@ai-interview.dev`
  - `RESEND_FROM_NAME="AI Interview Practice"`
  - `EMAIL_DEFAULT_FROM="AI Interview Practice <noreply@ai-interview.dev>"`
- **Kết quả kiểm thử**: Suite `email` PASS 4/4 test suites (18/18 tests).
- **Hành động Ops còn lại**: Cấu hình 3 bản ghi DNS trên nhà cung cấp tên miền:
  - CNAME (DKIM): `resend._domainkey` -> `feedback-smtp.us-east-1.amazonses.com` (tắt Cloudflare proxy).
  - TXT (SPF): `send` hoặc `@` -> `v=spf1 include:amazonses.com ~all`.
  - TXT (DMARC): `_dmarc` -> `v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com; aspf=r;`.

### 2.4 Production Infrastructure (Terraform) Validation

- **Kiểm tra mã nguồn IaC (`infra/terraform/modules/`)**:
  - **Mã hóa khi lưu trữ (Encryption at rest)**:
    - RDS PostgreSQL 16: `storage_encrypted = true`, KMS-managed encryption, SSL bắt buộc (`rds.force_ssl = 1`).
    - ElastiCache Redis 7: `at_rest_encryption_enabled = true`, `transit_encryption_enabled = true`, mật khẩu auth token ngẫu nhiên 32 ký tự.
    - S3 Storage: Customer-managed KMS key với tính năng key rotation tự động (`enable_key_rotation = true`), SSE-KMS (`sse_algorithm = "aws:kms"`), `bucket_key_enabled = true`.
  - **Cách ly mạng (Network Isolation)**:
    - VPC 3 tầng mạng: Public Subnets (ALB), Private App Subnets (ECS Fargate qua NAT Gateway), Private Data Subnets (RDS & Redis không có internet).
    - Security Groups siết chặt theo nguyên tắc tối thiểu: ALB mở 80/443; ECS chỉ chấp nhận traffic từ ALB; RDS/Redis chỉ chấp nhận kết nối từ ECS Security Group.
  - **Tách biệt quyền hạn IAM (Least Privilege)**:
    - Tách riêng `api_task_role`, `worker_task_role`, `web_task_role` và `ecs_execution_role`.
- **Kết quả chạy kiểm tra**:
  - `terraform init -backend=false`: Thành công, providers `aws v5.100.0` và `random v3.9.0` được cài đặt.
  - `terraform validate`: **Success! The configuration is valid.** (Exit code 0).
- **Hành động Ops còn lại**: Cấu hình AWS credentials, backend S3 state bucket, review `terraform plan` và `apply`.

---

## 3. Danh Sách Hành Động Cần Thực Hiện Trước Giờ G (Ops Action Items)

| Phân hệ            | Hành động cần làm                                                                                                                                                                               |  Người thực hiện   |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------: |
| **Stripe**         | 1. Đăng ký & KYC Stripe Dashboard.<br>2. Lấy `sk_live_...` và tạo Webhook signing secret `whsec_...`.                                                                                           |    Ops / Owner     |
| **PayOS**          | 1. Đăng ký tài khoản doanh nghiệp PayOS, gắn tài khoản Napas VietQR.<br>2. Lấy `Client ID`, `API Key`, `Checksum Key`.<br>3. Cấu hình Webhook URL trên PayOS Dashboard.                         |    Ops / Owner     |
| **DNS / Email**    | 1. Thêm 3 bản ghi CNAME, SPF TXT, DMARC TXT tại nhà cung cấp DNS.<br>2. Bấm verify trên Resend Dashboard cho đến khi trạng thái chuyển sang `Active`.                                           | Ops / Domain Admin |
| **Infrastructure** | 1. Khởi tạo AWS Parameter Store / Secrets Manager với các khóa bí mật.<br>2. Chạy `terraform plan` trên môi trường staging & production.<br>3. Thực hiện dry-run `infra/scripts/smoke-test.ts`. | SRE / DevOps Lead  |
