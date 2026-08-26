# BÁO CÁO CÁC LỖI PHÁT HIỆN MỚI (POST-IMPLEMENTATION AUDIT FINDINGS)
**Ngày kiểm định:** 2026-08-26  
**Trạng thái phát hành đề xuất:** NO-GO  
**Độ tin cậy:** HIGH (Kiểm định đối kháng độc lập)  

Tài liệu này tổng hợp toàn bộ các lỗi bảo mật, lỗi quyền hạn (Authorization/Authentication), lỗi toàn vẹn dữ liệu giao dịch, lỗi xử lý bất đồng bộ và khiếm khuyết cấu hình hạ tầng được phát hiện trong cuộc kiểm định độc lập sau triển khai cả 3 phases. Dùng làm backlog chi tiết để triển khai khắc phục (remediation) tiếp theo.

---

## 1. DANH SÁCH TOÀN BỘ BUG MỚI PHÁT HIỆN

### [NEW-SEC-01] P1 (High) — Infinite Quota Bypass for Interview Sessions (Thiếu Sink Ghi Nhận Hạn Mức)
- **Vị trí mã nguồn:** 
  - [interview.controller.ts:46-55](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/interview/interview.controller.ts#L46-L55)
  - [quota.guard.ts:34-41](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/billing/guards/quota.guard.ts#L34-L41)
  - [interview.service.ts:41-111](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/interview/interview.service.ts#L41-L111)
  - [usage-meter.service.ts:22-66](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/billing/usage-meter.service.ts#L22-L66)
- **Mô tả:** `QuotaGuard` chỉ kiểm tra hạn mức (`checkQuota` - non-mutating) dựa trên dữ liệu tổng hợp từ bảng `usage_records`. Tuy nhiên, trong suốt vòng đời tạo phiên phỏng vấn (`InterviewService.createSession`), hệ thống hoàn toàn không gọi `usageMeter.recordUsage()` hoặc `usageMeter.checkAndConsumeQuota()` để ghi nhận lượng sử dụng. Bảng `usage_records` luôn trống rỗng đối với `SESSION_COUNT`.
- **Tác động:** Người dùng gói Free có thể tạo vô số phiên phỏng vấn mà không bao giờ bị giới hạn hay nâng cấp gói dịch vụ.
- **Biện pháp xử lý đề xuất:** Chèn lệnh gọi `usageMeter.checkAndConsumeQuota(userId, BillingMetric.SESSION_COUNT, 1)` trực tiếp vào transaction khởi tạo session của `InterviewService.createSession`.

---

### [NEW-SEC-02] P1 (High) — Hardcoded Fallback Secret in Production Certificate Authority (F010)
- **Vị trí mã nguồn:**
  - [signature.service.ts:8-10](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/portfolio/services/signature.service.ts#L8-L10)
  - [env.validation.ts:3-67](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/platform/config/env.validation.ts#L3-L67)
  - [compute/main.tf:174-218](file:///C:/Users/Duong%20Vinh/ai-interview-practice/infra/terraform/modules/compute/main.tf#L174-L218)
- **Mô tả:** Khóa bí mật dùng để tạo chữ ký số cho chứng chỉ ứng viên (`CERTIFICATE_SECRET`) không được khai báo trong `EnvSchema` tại `env.validation.ts`, và không được cấu hình trong các tác vụ ECS/Terraform. Do đó, hệ thống luôn sử dụng chuỗi bí mật mặc định `'ai-interview-practice-secret-cert-key-2026'` được lưu trên git repository.
- **Tác động:** Bất kỳ ai cũng có thể tự tạo chữ ký số HMAC-SHA256 giả mạo cho các chứng chỉ năng lượng ảo mà không đạt tiêu chuẩn Gold/Platinum, rồi xác minh thành công trên trang verify công khai.
- **Biện pháp xử lý đề xuất:** Bổ sung cấu hình `CERTIFICATE_SECRET` vào schema kiểm tra môi trường, yêu cầu biến này bắt buộc phải có giá trị tối thiểu 32 ký tự ở môi trường production.

---

### [NEW-SEC-05] P1 (High) — Account Deletion Leaves Recurring Stripe Subscriptions Active (Orphan Billing & Privacy Violation)
- **Vị trí mã nguồn:**
  - [profile.service.ts:512-572](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/profile/profile.service.ts#L512-L572)
  - [billing.service.ts:541-590](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/billing/billing.service.ts#L541-L590)
  - [schema.prisma:100-120](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/prisma/schema.prisma#L100-L120)
- **Mô tả:** Trong luồng thực thi quyền xóa tài khoản (GDPR Right to Erasure) tại `ProfileService.deleteAccount`, hệ thống cập nhật `User.status = LOCKED` và đổi email thành `deleted_...`, nhưng **hoàn toàn không kiểm tra bảng `Subscription` và không gọi Stripe API để hủy gói định kỳ (`stripe.subscriptions.cancel`)**.
- **Tác động:** Stripe tiếp tục tự động trừ tiền thẻ tín dụng định kỳ của khách hàng hàng tháng/hàng năm. Người dùng không thể đăng nhập vào ứng dụng để hủy đăng ký vì tài khoản đã bị khóa và email bị ẩn danh hóa.
- **Biện pháp xử lý đề xuất:** Trong transaction `deleteAccount`, kiểm tra các subscription đang active, gọi `StripeProvider.cancelSubscription()` và cập nhật `Subscription.status = CANCELLED`.

---

### [NEW-AUTH-01] P1 (High) — Ineffective Admin MFA Token Enforcement (Advisory Response Still Issues Full Access Tokens)
- **Vị trí mã nguồn:**
  - [auth.service.ts:248-256](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/auth/auth.service.ts#L248-L256)
  - [jwt.strategy.ts:25-78](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/auth/strategies/jwt.strategy.ts#L25-L78)
  - [roles.guard.ts:32-55](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/auth/guards/roles.guard.ts#L32-L55)
- **Mô tả:** Khi tài khoản Admin chưa kích hoạt MFA đăng nhập thành công bằng mật khẩu, `AuthService.login()` gọi `generateAuthResponse(user, false)` cấp một JWT access token hoàn chỉnh (`tokenType: 'access'`, `role: 'ADMIN'`) và refresh token 7 ngày. Token loại `mfa_enrollment` không bao giờ được tạo ra. Mặc dù các route admin có `MfaStepUpGuard` chặn lại, admin unenrolled vẫn sở hữu access token hợp lệ để gọi toàn bộ các API người dùng thông thường và WebSocket voice.
- **Tác động:** Vi phạm nguyên tắc phân quyền tối thiểu (Least Privilege). Mật khẩu admin bị lộ cho phép kẻ tấn công truy cập API người dùng và WebSocket trước khi thiết lập MFA.
- **Biện pháp xử lý đề xuất:** Khi `user.role === ADMIN && !user.mfaEnabled`, `login()` bắt buộc phải ký token với `tokenType: 'mfa_enrollment'` và thời hạn 15 phút, không cấp refresh token.

---

### [NEW-ASYNC-01] P1 (High) — Silent Terminal Evaluation Drop for Completed Interview Learning Paths (Swallowed Queue Error)
- **Vị trí mã nguồn:**
  - [evaluation.processor.ts:256-267](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/evaluation/evaluation.processor.ts#L256-L267)
  - [evaluation.processor.ts:388-406](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/evaluation/evaluation.processor.ts#L388-L406)
- **Mô tả:** Khi ứng viên hoàn thành câu trả lời turn 5 (turn cuối), database cập nhật `SessionState.COMPLETED`. Tại dòng 401-405, lệnh gọi `learningPathQueue.add` nếu gặp lỗi kết nối Redis tạm thời sẽ bị bắt và nuốt trọn trong `catch (lpErr) { logger.warn(...) }`. Do session đã mang trạng thái terminal `COMPLETED`, khi BullMQ retry job đánh giá câu trả lời, guard dòng 85-91 và dòng 420 sẽ bỏ qua toàn bộ side-effect hoàn thành.
- **Tác động:** Lộ trình học tập (Learning Path) của phiên phỏng vấn bị mất vĩnh viễn không thể khôi phục, ứng viên không nhận được kế hoạch cải thiện sau phỏng vấn.
- **Biện pháp xử lý đề xuất:** Triển khai bảng Outbox ghi nhận intent tạo Learning Path trước khi commit `COMPLETED`, kèm background worker quét outbox để retry bền vững.

---

### [NEW-OPS-01] P1 (High) — Incomplete Production Secrets in Terraform & ECS Task Definitions
- **Vị trí mã nguồn:**
  - [secrets/main.tf:38-46](file:///C:/Users/Duong%20Vinh/ai-interview-practice/infra/terraform/modules/secrets/main.tf#L38-L46)
  - [compute/main.tf:330-385](file:///C:/Users/Duong%20Vinh/ai-interview-practice/infra/terraform/modules/compute/main.tf#L330-L385)
- **Mô tả:** Module `secrets/main.tf` để trống các key `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` và hoàn toàn thiếu các key `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `MFA_ENCRYPTION_KEY`, `CERTIFICATE_SECRET`. Module `compute/main.tf` cũng không truyền các biến này vào container task definition.
- **Tác động:** Ứng dụng ECS khi khởi động trên AWS production sẽ crash hoặc ném lỗi 503 fail-closed khi người dùng gọi chức năng phỏng vấn AI, thanh toán PayOS hoặc kích hoạt MFA.
- **Biện pháp xử lý đề xuất:** Bổ sung đầy đủ các biến môi trường bí mật vào Secrets Manager và ánh xạ vào ECS Task Definition trong Terraform.

---

### [NEW-SEC-03] P2 (Medium) — Cleartext JWT Access Token Exposure in Server/Proxy Logs via SSE Query Parameter
- **Vị trí mã nguồn:**
  - [interview.controller.ts:145-160](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/interview/interview.controller.ts#L145-L160)
  - [nginx.conf:36-52](file:///C:/Users/Duong%20Vinh/ai-interview-practice/infra/nginx/nginx.conf#L36-L52)
- **Mô tả:** Do trình duyệt Native `EventSource` không hỗ trợ custom header, frontend bắt buộc phải gửi token qua URL query parameter: `GET /api/v1/interviews/{id}/events?token=eyJhbGci...`.
- **Tác động:** Toàn bộ access log của Nginx Proxy, AWS ALB hoặc CDN sẽ ghi nhận nguyên văn URL chứa token bí mật của người dùng dưới dạng cleartext.
- **Biện pháp xử lý đề xuất:** Thiết lập luồng trao đổi Single-Use Ephemeral Ticket qua POST request hoặc sử dụng thư viện `@microsoft/fetch-event-source` hỗ trợ Bearer header.

---

### [NEW-SEC-04] P2 (Medium) — Concurrent Refresh Token Revocation Race Condition (Session Drop)
- **Vị trí mã nguồn:**
  - [api-client.ts:53-79](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/web/src/lib/api-client.ts#L53-L79)
  - [auth.service.ts:281-350](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/auth/auth.service.ts#L281-L350)
- **Mô tả:** Khi Access Token hết hạn, nếu frontend gọi nhiều API đồng thời (ví dụ: load dashboard gọi 5 API cùng lúc), cả 5 request đều nhận 401 và đồng loạt gọi API `/auth/refresh` với cùng một Refresh Token. Request đầu tiên xoay vòng token; 4 request sau đến server với token cũ sẽ bị coi là hành vi replay token và lập tức revoke toàn bộ session family.
- **Tác động:** Người dùng liên tục bị văng khỏi hệ thống (force logout) ngẫu nhiên khi chuyển trang.
- **Biện pháp xử lý đề xuất:** Thêm Promise Mutex lock (in-flight request deduplication) vào file `api-client.ts` để gộp các request refresh song song.

---

### [NEW-SEC-06] P2 (Medium) — Overbroad Mentor Score Override Across Entire Candidate History (Missing Foreign Key Binding)
- **Vị trí mã nguồn:**
  - [live-session.service.ts:206-247](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/mentor/services/live-session.service.ts#L206-L247)
  - [schema.prisma:1455-1478](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/prisma/schema.prisma#L1455-L1478)
- **Mô tả:** Bảng `live_sessions` không có khóa ngoại trỏ tới `interview_id`. Hàm `overrideScore` chỉ kiểm tra quan hệ `mentorId` và `candidateId`. Mentor M có thể sửa điểm đánh giá của bất kỳ buổi phỏng vấn nào trong lịch sử của ứng viên C (kể cả phỏng vấn tự luyện với AI từ lâu hoặc phỏng vấn với mentor khác).
- **Tác động:** Sửa sai lệch điểm năng lực và bảng xếp hạng ứng viên ngoài phạm vi buổi mentor trực tiếp.
- **Biện pháp xử lý đề xuất:** Thêm trường `interviewId String? @db.Uuid` vào model `LiveSession`, ràng buộc việc override chỉ được thực hiện trên chính session phỏng vấn được gắn kèm.

---

### [NEW-AUTH-02] P2 (Medium) — Middleware Lifecycle Dead Code in B2B Single-Tenant Auto-Resolution
- **Vị trí mã nguồn:**
  - [tenant-context.middleware.ts:17-47](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/b2b/middleware/tenant-context.middleware.ts#L17-L47)
  - [tenant-role.guard.ts:34-49](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/b2b/guards/tenant-role.guard.ts#L34-L49)
- **Mô tả:** Trong NestJS, Express Middleware chạy trước Passport `JwtAuthGuard`. Khi `TenantContextMiddleware.use()` thực thi, `req.user` là `undefined`. Toàn bộ khối logic tự động resolve tenant cho single-tenant user (dòng 34-47) trở thành dead code. Request đi tới `TenantRoleGuard` và luôn bị ném lỗi 403 Forbidden nếu thiếu header.
- **Tác động:** Tính năng auto-resolve tenant không hoạt động ở runtime.
- **Biện pháp xử lý đề xuất:** Chuyển logic resolve `tenantId` từ Middleware sang `TenantRoleGuard` hoặc NestJS Interceptor chạy sau `JwtAuthGuard`.

---

### [NEW-FUNC-01] P2 (Medium) — Synthetic Length-Based Score Inflation in Socratic Tutor Retry (F006)
- **Vị trí mã nguồn:**
  - [tutor.service.ts:294-303](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/tutor/tutor.service.ts#L294-L303)
- **Mô tả:** Trong tính năng Socratic Tutor Retry, hệ thống không gọi AI chấm điểm lại mà tăng điểm cơ học dựa trên độ dài của câu trả lời mới so với câu trả lời cũ (`dto.retryAnswer.length - originalAnswer.length > 50`). Điểm số này được trực tiếp lưu vào bảng `question_retries`.
- **Tác động:** Người dùng chỉ cần viết thêm bất kỳ 50 ký tự vô nghĩa nào cũng tự động được chấm điểm cao (lên tới 8.0-9.0), làm sai lệch đánh giá năng lực.
- **Biện pháp xử lý đề xuất:** Gọi `AiOrchestratorService` để thực hiện đánh giá thực sự bằng LLM theo rubric chuẩn.

---

### [NEW-FUNC-03] P2 (Medium) — Ephemeral In-Memory Signing Key in MockMediaProvider Breaks Across Multi-Replica/Restarts
- **Vị trí mã nguồn:**
  - [mock-media.provider.ts:7](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/mentor/providers/mock-media.provider.ts#L7)
  - [mentor.module.ts:20](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/mentor/mentor.module.ts#L20)
- **Mô tả:** `MockMediaProvider` khởi tạo `signingKey = crypto.randomBytes(32)` trong bộ nhớ RAM khi class được instantiate. Mỗi replica sở hữu một key ngẫu nhiên khác nhau. Token phòng phỏng vấn Live Mentor sinh ra bởi Replica A khi gửi sang Replica B sẽ bị từ chối do sai chữ ký số.
- **Tác động:** Rớt kết nối Live Mentor trên môi trường multi-instance hoặc sau khi API khởi động lại.
- **Biện pháp xử lý đề xuất:** Sử dụng secret key cấu hình qua `ConfigService` và triển khai provider WebRTC/LiveKit thực tế.

---

### [NEW-PRIV-01] P2 (Medium) — B2B CSV Roster Import Generates Unreachable Credentials & Lacks User Consent (F011)
- **Vị trí mã nguồn:**
  - [cohort.service.ts:140-178](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/b2b/services/cohort.service.ts#L140-L178)
  - [tenant-context.middleware.ts:34-47](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/b2b/middleware/tenant-context.middleware.ts#L34-L47)
- **Mô tả:** Khi import sinh viên qua CSV, nếu sinh viên chưa có tài khoản, hệ thống tạo user mới với mật khẩu ngẫu nhiên mà không gửi bất kỳ email kích hoạt tài khoản hay đặt lại mật khẩu. Nếu user đã tồn tại, hệ thống tự động gán user đó vào tenant member mà không cần sự xác nhận đồng ý của người dùng.
- **Tác động:** Người dùng được import không thể truy cập tài khoản mới; tài khoản cá nhân có sẵn bị ép chia sẻ dữ liệu ngữ cảnh cho tổ chức.
- **Biện pháp xử lý đề xuất:** Triển khai cơ chế gửi email mời (Tenant Invitation Token) thay vì ép buộc gán quan hệ trực tiếp trong database.

---

### [NEW-DATA-01] P3 (Low) — Timezone Inconsistency in Flashcard FSRS Spaced-Repetition Streak Calculation (F005)
- **Vị trí mã nguồn:**
  - [flashcard.service.ts:232-264](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/flashcards/flashcard.service.ts#L232-L264)
- **Mô tả:** Việc sử dụng `now.toISOString().split('T')[0]` để tính ngày học bài cho streak dựa theo mốc giờ UTC.
- **Tác động:** Gây lệch ngày và reset/sai lệch streak đối với ứng viên học tập tại múi giờ địa phương khác UTC (Ví dụ múi giờ Việt Nam UTC+7 học bài vào lúc rạng sáng).
- **Biện pháp xử lý đề xuất:** Đồng bộ hóa múi giờ lưu trữ theo cấu hình người dùng thay vì dùng cứng UTC ISO.

---

### [NEW-ARCH-01] P3 (Low) — Database Column Overloading (`pdfUrl`) for JSON Payment Metadata
- **Vị trí mã nguồn:**
  - [billing.service.ts:404](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/billing/billing.service.ts#L404)
- **Mô tả:** Trong luồng tạo VietQR PayOS payment link, dữ liệu `{ planSlug, billingCycle }` được ép kiểu JSON string và lưu vào cột `pdfUrl` của bảng `Invoice` để làm siêu dữ liệu lưu vết.
- **Tác động:** Gây khó khăn trong quản trị dữ liệu, vi phạm thiết kế cơ sở dữ liệu và dễ gây lỗi runtime nếu cột này sau đó được đọc dưới dạng URL trực tiếp.
- **Biện pháp xử lý đề xuất:** Tạo cột metadata riêng kiểu JSON hoặc lưu trữ trong bảng trung gian.

---

### [NEW-INFRA-01] P3 (Low) — Nginx WebSocket Upgrade Header Case-Sensitivity
- **Vị trí mã nguồn:**
  - [nginx.conf:18-21](file:///C:/Users/Duong%20Vinh/ai-interview-practice/infra/nginx/nginx.conf#L18-L21)
- **Mô tả:** Rule `map $http_upgrade $is_websocket_upgrade` chỉ match tĩnh `~*^websocket$`. Trong môi trường HTTP/1.1, client có thể gửi header `Connection: Upgrade, keep-alive`. Rule hiện tại proxy tĩnh `proxy_set_header Connection upgrade;` cho `/voice` thay vì dùng `$http_connection` map.
- **Tác động:** Một số client hoặc proxy trung gian ngặt nghèo có thể gặp lỗi rớt kết nối Handshake WebSocket.
- **Biện pháp xử lý đề xuất:** Sử dụng chuẩn Nginx map cho `$http_connection` dựa trên `$http_upgrade`.

---

### [NEW-SEC-07] P1 (High) — Unverified MFA Admin BOLA Across All Protected Service Domains
- **Vị trí mã nguồn:**
  - [interview.controller.ts:60-66](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/interview/interview.controller.ts#L60-L66) -> [interview.service.ts:229,254,287](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/interview/interview.service.ts#L229)
  - [history-report.service.ts:136](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/history-report/history-report.service.ts#L136)
  - [learning-path.service.ts:39](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/learning-path/learning-path.service.ts#L39)
  - [storage.service.ts:284,313](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/storage/storage.service.ts#L284)
  - [behavioral.service.ts:40,163](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/interview/behavioral/behavioral.service.ts#L40)
  - [voice-streaming.gateway.ts:226](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/voice-gateway/gateways/voice-streaming.gateway.ts#L226)
- **Mô tả:** Các endpoint thông thường chỉ có `@UseGuards(JwtAuthGuard)` mà không có `RolesGuard` hay `MfaStepUpGuard`. Tại tầng Service layer, logic authorization kiểm tra `if (session.userId !== userId && userRole !== UserRole.ADMIN)`. Vì admin chưa verify MFA vẫn nhận JWT token có `role: 'ADMIN'` từ `AuthService.login()`, kẻ tấn công có mật khẩu admin có thể gọi thẳng các API thông thường để đọc/xóa toàn bộ phỏng vấn, lộ trình học, file storage, bản ghi âm và báo cáo của mọi ứng viên.
- **Tác động:** BOLA nghiêm trọng, phá vỡ rào chắn MFA cấp ứng dụng đối với toàn bộ dữ liệu ứng viên.
- **Biện pháp xử lý đề xuất:** Kiểm tra đồng thời `userRole === UserRole.ADMIN && user.mfaVerified === true` ở tầng service-layer, hoặc không cấp quyền ADMIN trước khi hoàn tất MFA challenge.

---

### [NEW-FUNC-04] P1 (High) — Hardcoded Mock Vision Injection in Canvas Diagram Analysis (F003)
- **Vị trí mã nguồn:**
  - [design-analyzer.service.ts:10-14](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/system-design/services/design-analyzer.service.ts#L10-L14)
  - [design-analyzer.service.ts:50-54](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/system-design/services/design-analyzer.service.ts#L50-L54)
- **Mô tả:** Constructor của `DesignAnalyzerService` tiêm trực tiếp `private readonly visionProvider: MockVisionProvider` thay vì tiêm dynamic token `@Inject('VISION_PROVIDER')`.
- **Tác động:** Khi ứng viên thực hiện phân tích sơ đồ thiết kế hệ thống trên canvas (`POST /api/v1/interviews/:id/canvas/analyze`), hệ thống luôn luôn chạy MockVisionProvider và trả về dữ liệu mẫu cứng, hoàn toàn bỏ qua các model Vision AI thực tế như OpenAI Vision hoặc Gemini Vision được cấu hình trong production.
- **Biện pháp xử lý đề xuất:** Chuyển sang tiêm `@Inject('VISION_PROVIDER') private readonly visionProvider: VisionProvider`.

---

### [NEW-FUNC-05] P1 (High) — Socratic AI Tutor (F006) Is Entirely Canned Keyword Matching with Simulated Streaming (Zero LLM Invocation)
- **Vị trí mã nguồn:**
  - [tutor.service.ts:145-258](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/tutor/tutor.service.ts#L145-L258)
- **Mô tả:** Tính năng Socratic AI Tutor trò chuyện trực tiếp không gọi bất kỳ LLM provider nào (OpenAI/Gemini/Anthropic). Phương thức `generateSocraticResponse` chỉ kiểm tra chuỗi tĩnh bằng `msg.includes()`, sau đó dùng vòng lặp `for` với `setTimeout(r, 15)` để tạo hiệu ứng streaming giả tạo token-by-token.
- **Tác động:** Tính năng gia sư AI thích ứng là giả lập tĩnh, không có khả năng hiểu ngữ cảnh câu hỏi của người dùng.
- **Biện pháp xử lý đề xuất:** Tích hợp `AiOrchestratorService.streamChat` vào `TutorService.sendChatMessageStream` với prompt Socratic.

---

### [NEW-SEC-08] P2 (Medium) — Public Certificate Verification Allows Unbounded Denial of Service & Database Contention
- **Vị trí mã nguồn:**
  - [verification.controller.ts:12-16](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/portfolio/controllers/verification.controller.ts#L12-L16)
  - [certificate.service.ts:112-147](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/portfolio/services/certificate.service.ts#L112-L147)
- **Mô tả:** `GET /api/v1/public/verify/:certId` là endpoint public unauthenticated không có `@Throttle` rate limiting. Mỗi request GET thực hiện một lệnh ghi cơ sở dữ liệu `prisma.certificate.update({ data: { verifyCount: { increment: 1 } } })`.
- **Tác động:** Kẻ tấn công có thể spam hàng ngàn request đồng thời gây khóa hàng (row-level lock contention) trên bảng `certificates`, làm cạn kiệt connection pool PostgreSQL.
- **Biện pháp xử lý đề xuất:** Bổ sung `@Throttle` và chuyển việc đếm lượt xem sang Redis buffer/hyperloglog bất đồng bộ.

---

### [NEW-SEC-09] P2 (Medium) — Unhandled Ciphertext Decode in `TotpUtil.decryptSecret` Crashes Process on Corrupted Secrets
- **Vị trí mã nguồn:**
  - [totp.util.ts:165-185](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/auth/utils/totp.util.ts#L165-L185)
  - [auth.service.ts:517,629,787](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/auth/auth.service.ts#L517)
- **Mô tả:** Khi hàm `decipher` ném ngoại lệ trong khối `try`, khối `catch` tại dòng 182-184 lại trả về nguyên văn chuỗi mã hóa (`encryptedPayload`: dạng `iv:authTag:cipher`). Sau đó `TotpUtil.base32Decode()` ném lỗi `Invalid Base32 character`, gây crash unhandled exception.
- **Tác động:** Lỗi 500 unhandled crash khi giải mã bí mật TOTP bị lỗi định dạng.
- **Biện pháp xử lý đề xuất:** Ném ngoại lệ bảo mật kiểm soát được thay vì trả về ciphertext.

---

### [NEW-OPS-02] P2 (Medium) — Default Docker Compose Production Crashes AI Router Startup
- **Vị trí mã nguồn:**
  - [docker-compose.yml:50-92](file:///C:/Users/Duong%20Vinh/ai-interview-practice/docker-compose.yml#L50-L92)
  - [provider-router.service.ts:85-93](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/ai-orchestrator/router/provider-router.service.ts#L85-L93)
- **Mô tả:** `docker-compose.yml` đặt `NODE_ENV: production` cho `api` và `worker`, nhưng mặc định `AI_PROVIDER: ${AI_PROVIDER:-mock}` và không cấu hình `AI_ALLOW_MOCK: "true"`. `ProviderRouterService.getPriorityChain()` ném ngoại lệ `Error: Mock AI provider cannot be primary provider in production`.
- **Tác động:** Khởi động docker compose mặc định gây lỗi chặn toàn bộ tác vụ AI phỏng vấn.
- **Biện pháp xử lý đề xuất:** Thêm biến `AI_ALLOW_MOCK: "true"` vào `docker-compose.yml` cho demo hoặc cấu hình provider thật.

---

### [NEW-FE-01] P1 (High) — Hardcoded Blank Canvas SVG Data URI in System Design Whiteboard (F003)
- **Vị trí mã nguồn:**
  - [WhiteboardRoom.tsx:106,115](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/web/src/features/system-design/WhiteboardRoom.tsx#L106)
- **Mô tả:** Trong giao diện Whiteboard System Design, các hàm `handleSaveSnapshot` và `handleTriggerAnalysis` hardcode chuỗi dữ liệu `snapshotUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="%23f8fafc"/></svg>'` thay vì xuất hình ảnh hoặc SVG thực tế từ các phần tử do ứng viên vẽ.
- **Tác động:** AI Vision khi phân tích sơ đồ trên backend luôn luôn nhận được một hình chữ nhật trắng trống rỗng, khiến việc đánh giá trực quan hình ảnh kiến trúc hệ thống hoàn toàn vô nghĩa.
- **Biện pháp xử lý đề xuất:** Viết logic tuần tự hóa DOM / Canvas xuất sang chuỗi SVG hoặc PNG Base64 thực sự của toàn bộ elements trên whiteboard.

---

### [NEW-EVENT-01] P1 (High) — Event Payload Contract Mismatch Breaks Interview Completion Email Notifications
- **Vị trí mã nguồn:**
  - [evaluation.processor.ts:413-418](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/evaluation/evaluation.processor.ts#L413-L418)
  - [email-events.listener.ts:64-75](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/email/listeners/email-events.listener.ts#L64-L75)
- **Mô tả:** `EvaluationProcessor` phát sự kiện `'interview.completed'` với payload `{ userId, sessionId, overallScore, sessionMode }` (hoàn toàn không có trường `email`). `EmailEventsListener` lắng nghe sự kiện này và gọi `sendInterviewCompletionEmail(event.email, ...)` với `event.email === undefined`. Resend/MockEmailProvider nhận `to: [undefined]` và ném lỗi `Missing "to" field`.
- **Tác động:** 100% email báo cáo hoàn thành phỏng vấn gửi cho ứng viên bị lỗi crash ở runtime.
- **Biện pháp xử lý đề xuất:** `EvaluationProcessor` truy vấn `session.user.email` và truyền đầy đủ vào payload của sự kiện `'interview.completed'`.

---

### [NEW-DATA-02] P2 (Medium) — Non-Atomic `totalXp` Calculation Causes Lost Updates Under Concurrency
- **Vị trí mã nguồn:**
  - [xp.service.ts:119-141](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/gamification/xp.service.ts#L119-L141)
- **Mô tả:** `newTotalXp` được tính toán trong bộ nhớ Node.js `(existing?.totalXp || 0) + amount` và ghi đè dưới dạng giá trị tuyệt đối trong Prisma update (`totalXp: newTotalXp`), trong khi `dailyXp` dùng atomic `{ increment: amount }`. Khi có 2 tác vụ cộng XP đồng thời (ví dụ: hoàn thành câu hỏi + bonus streak), tác vụ sau ghi đè tác vụ trước gây mất XP và lệch level. Ngoài ra, event `gamification.xp_awarded` được emit bên trong transaction trước khi commit.
- **Tác động:** Ứng viên bị mất điểm kinh nghiệm XP và hỏng tiến trình lên cấp (Level Up) khi có tương tác đồng thời.
- **Biện pháp xử lý đề xuất:** Sử dụng atomic `{ increment: amount }` cho `totalXp` hoặc khóa dòng Pessimistic Locking trong database transaction, đồng thời di chuyển emit event ra ngoài khối transaction.

---

### [NEW-ANALYTICS-01] P2 (Medium) — Non-Authoritative Mock Evaluations Contaminate Candidate Competency Radar
- **Vị trí mã nguồn:**
  - [analytics.service.ts:125-165](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/analytics/analytics.service.ts#L125-L165)
- **Mô tả:** `AnalyticsService.getCompetencyRadar` tổng hợp tất cả các bản ghi `turn.answer.evaluation` mà không lọc theo điều kiện `authorityState === 'AUTHORITATIVE'`. Các bản đánh giá từ Mock Provider hoặc bản đánh giá chưa được kiểm định (`needsReview === true`) vẫn bị tính vào biểu đồ radar năng lực chính thức.
- **Tác động:** Làm sai lệch radar năng lực và xếp hạng trình độ (Senior/Mid/Junior) của ứng viên bằng dữ liệu giả lập.
- **Biện pháp xử lý đề xuất:** Thêm điều kiện `where: { authorityState: 'AUTHORITATIVE' }` khi truy vấn evaluation trong AnalyticsService.

---

### [NEW-READINESS-01] P2 (Medium) — Default Null `competencyArea` Forces All Session Turns into `SYSTEM_DESIGN`
- **Vị trí mã nguồn:**
  - [readiness.service.ts:97-100](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/readiness/services/readiness.service.ts#L97-L100)
- **Mô tả:** `turn.session.competencyArea ? (turn.session.competencyArea as CompetencyArea) : CompetencyArea.SYSTEM_DESIGN`. Vì các phiên phỏng vấn thông thường (Fullstack, Backend, Frontend) không gán trường `competencyArea` cho từng session, tất cả các câu hỏi được gom hết vào `SYSTEM_DESIGN`. 4 nhóm năng lực cốt lõi còn lại (Language Core, Database, Architecture, Resilience) nhận điểm 0.
- **Tác động:** Chỉ số sẵn sàng tuyển dụng (Readiness Index) bị sai lệch nghiêm trọng cho toàn bộ người dùng thực hiện phỏng vấn tổng hợp.
- **Biện pháp xử lý đề xuất:** Suy luận `competencyArea` từ `turn.question.category` hoặc keyword mapping thay vì fallback cứng về `SYSTEM_DESIGN`.

---

### [NEW-FUNC-06] P2 (Medium) — Flashcard Auto-Generation Uses Static Hardcoded Template Instead of AI (F005)
- **Vị trí mã nguồn:**
  - [flashcard.service.ts:338-342](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/flashcards/flashcard.service.ts#L338-L342)
- **Mô tả:** Tính năng tự động tạo Flashcard ôn tập từ điểm yếu phỏng vấn (`autoGenerateFlashcards`) gắn cứng nội dung mặt sau thẻ (backContent) bằng đoạn văn mẫu tĩnh: `Ensure fault isolation and clear resource limits... Discuss failure modes...` mà không hề gọi AI Orchestrator hay LLM để giải thích điểm yếu đó.
- **Tác động:** Mọi thẻ bài flashcard được sinh ra cho mọi điểm yếu khác nhau đều có chung một nội dung giải thích mẫu giống hệt nhau.
- **Biện pháp xử lý đề xuất:** Tích hợp `AiOrchestratorService` tạo câu hỏi ôn tập và câu trả lời mẫu sát với ngữ cảnh điểm yếu của từng câu trả lời.

---

### [NEW-ASYNC-02] P2 (Medium) — Silent Learning Path Generation Failure Leaves Frontend in Permanent Spinner
- **Vị trí mã nguồn:**
  - [learning-path.processor.ts:117-138](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/learning-path/learning-path.processor.ts#L117-L138)
- **Mô tả:** Khi `LearningPathProcessor` gặp lỗi và vượt quá số lần retry, nó cập nhật trạng thái `FAILED` vào cơ sở dữ liệu nhưng không phát bất kỳ sự kiện SSE nào (ví dụ `SseEventType.SESSION_FAILED` hoặc `LEARNING_PATH_FAILED`) tới client.
- **Tác động:** Ứng viên ở màn hình kết quả phỏng vấn bị treo vô tận ở trạng thái "Đang khởi tạo lộ trình học tập..." mà không hề nhận được thông báo lỗi để bấm thử lại.
- **Biện pháp xử lý đề xuất:** Phát sự kiện SSE thông báo lỗi kèm nút "Thử tạo lại lộ trình học" trên frontend.

---

### [NEW-OPS-03] P2 (Medium) — Streak Reminder Cron Fails Over to Local Lock Causing Duplicate Multi-Pod Spam
- **Vị trí mã nguồn:**
  - [streak-reminder.cron.ts:105-116](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/notifications/streak-reminder.cron.ts#L105-L116)
- **Mô tả:** Khi Redis gặp trục trặc tạm thời, hàm `acquireDistributedLock` tự động chuyển sang cơ chế khóa bộ nhớ cục bộ (`localExecutionLocks`). Trong mô hình chạy 4 replicas (2 API + 2 Worker), cả 4 pods đều chiếm được khóa cục bộ và đồng thời gửi 4 thông báo push trùng lặp tới cùng một người dùng lúc 8 giờ tối.
- **Tác động:** Người dùng bị spam nhiều thông báo push cùng lúc khi Redis chập chờn.
- **Biện pháp xử lý đề xuất:** Fail-closed (bỏ qua lượt chạy nếu không kết nối được Redis distributed lock) thay vì fallback sang local memory lock.

---

### [NEW-B2B-01] P2 (Medium) — Cohort Analytics Conflates Tenant-Wide Sessions with Cohort Assignment Completions
- **Vị trí mã nguồn:**
  - [cohort-analytics.service.ts:140-141](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/b2b/services/cohort-analytics.service.ts#L140-L141)
  - [assignment.service.ts:92](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/b2b/services/assignment.service.ts#L92)
- **Mô tả:** `CohortAnalyticsService` gán `completedAssignments = u.sessions.length` (tổng tất cả các bài phỏng vấn của user trong tenant), sau đó chia cho `cohort.assignments.length`. Nếu học viên tự luyện tập 5 bài ngoài luồng, tỷ lệ hoàn thành bài tập của cohort hiển thị thành 5/1 (500%).
- **Tác động:** Số liệu báo cáo tiến độ đào tạo của doanh nghiệp bị sai lệch nghiêm trọng.
- **Biện pháp xử lý đề xuất:** Chỉ tính các session có liên kết trực tiếp với `assignmentId` thuộc về cohort tương ứng.

---

### [NEW-BILLING-01] P3 (Low) — Missing Payment Succeeded Confirmation Event for Stripe Subscriptions
- **Vị trí mã nguồn:**
  - [stripe.provider.ts:253-313](file:///C:/Users/Duong%20Vinh/ai-interview-practice/apps/api/src/modules/billing/providers/stripe.provider.ts#L253-L313)
- **Mô tả:** Trong webhook của Stripe (`checkout.session.completed` và `invoice.payment_succeeded`), sau khi kích hoạt gói thuê bao và tạo hóa đơn, hệ thống không phát sự kiện `billing.payment_succeeded` (như đã làm ở PayOS).
- **Tác động:** Khách hàng thanh toán qua cổng quốc tế Stripe không nhận được email biên lai xác nhận thanh toán tự động.
- **Biện pháp xử lý đề xuất:** Phát sự kiện `this.eventEmitter.emit('billing.payment_succeeded', ...)` trong cả hai nhánh xử lý webhook của Stripe.

---

## 2. BẢNG PHÂN LOẠI & THỨ TỰ ƯU TIÊN KHẮC PHỤC (REMEDIATION ROADMAP)

| Thứ tự | ID Lỗi | Mức độ | Nhóm chuyên môn | Mục tiêu xử lý |
| :---: | :--- | :---: | :--- | :--- |
| **1** | `NEW-SEC-05` | **P1** | Billing / Privacy | Hủy subscription Stripe ngay khi xóa tài khoản; tránh trừ tiền oan. |
| **2** | `NEW-SEC-01` | **P1** | Billing / Quota | Gọi `usageMeter.checkAndConsumeQuota` khi tạo interview session. |
| **3** | `NEW-AUTH-01` | **P1** | Auth / Identity | Cấp token `tokenType: 'mfa_enrollment'` cho admin chưa bật MFA. |
| **4** | `NEW-SEC-07` | **P1** | Authorization | Kiểm tra `mfaVerified` khi bypass bằng role `ADMIN` tại mọi service layer. |
| **5** | `NEW-FE-01` | **P1** | Frontend / Canvas | Xuất dữ liệu Canvas/SVG thực tế thay vì hardcode chuỗi SVG rỗng. |
| **6** | `NEW-EVENT-01` | **P1** | Event / Email | Truyền `email` vào payload của `interview.completed` event. |
| **7** | `NEW-FUNC-04` | **P1** | AI / Vision | Tiêm `@Inject('VISION_PROVIDER')` trong `DesignAnalyzerService`. |
| **8** | `NEW-FUNC-05` | **P1** | AI / Tutor | Tích hợp LLM streaming thực sự cho Socratic Tutor thay vì chuỗi tĩnh. |
| **9** | `NEW-ASYNC-01` | **P1** | Async / Queue | Thêm Transactional Outbox chống mất Learning Path khi hoàn thành phỏng vấn. |
| **10** | `NEW-OPS-01` | **P1** | DevOps / Infra | Bổ sung đầy đủ 7 secret keys vào Terraform Secrets Manager & ECS Task. |
| **11** | `NEW-SEC-02` | **P1** | Security / Crypto | Khai báo `CERTIFICATE_SECRET` trong EnvSchema & ECS config. |
| **12** | `NEW-DATA-02` | **P2** | Gamification | Dùng atomic increment cho `totalXp` chống race condition mất điểm. |
| **13** | `NEW-READINESS-01` | **P2** | Analytics / Score | Map competency theo category câu hỏi thay vì fallback về System Design. |
| **14** | `NEW-ANALYTICS-01` | **P2** | Analytics | Lọc `authorityState === 'AUTHORITATIVE'` khi tính Competency Radar. |
| **15** | `NEW-SEC-04` | **P2** | Frontend / Auth | Thêm Mutex lock chống race condition khi refresh access token. |
| **16** | `NEW-SEC-06` | **P2** | Authorization | Thêm `interviewId` vào `LiveSession` schema để cô lập quyền sửa điểm. |
| **17** | `NEW-SEC-08` | **P2** | Security / DoS | Thêm `@Throttle` và async view buffer cho public certificate verification. |
| **18** | `NEW-SEC-09` | **P2** | Security / Crypto | Xử lý ngoại lệ fail-closed an toàn trong `TotpUtil.decryptSecret`. |
| **19** | `NEW-FUNC-06` | **P2** | AI / Flashcards | Tích hợp AI tạo nội dung ôn tập điểm yếu thay vì template tĩnh. |
| **20** | `NEW-ASYNC-02` | **P2** | Async / Realtime | Phát sự kiện SSE báo lỗi khi sinh Learning Path thất bại. |
| **21** | `NEW-OPS-03` | **P2** | Cron / Reliability | Fail-closed distributed lock cho cron nhắc nhở học tập. |
| **22** | `NEW-B2B-01` | **P2** | B2B / Analytics | Lọc session theo `assignmentId` khi tính tiến độ hoàn thành cohort. |
| **23** | `NEW-OPS-02` | **P2** | DevOps / Docker | Đồng bộ `AI_ALLOW_MOCK` trong `docker-compose.yml`. |
| **24** | `NEW-AUTH-02` | **P2** | B2B / Auth | Chuyển auto-resolve single-tenant từ Middleware sang Guard. |
| **25** | `NEW-SEC-03` | **P2** | Realtime / Security | Chuyển token SSE từ URL Query Param sang Header hoặc Ephemeral Ticket. |
| **26** | `NEW-FUNC-01` | **P2** | AI / Correctness | Thay logic chấm điểm độ dài chuỗi bằng AI rubric thực sự cho Socratic Retry. |
| **27** | `NEW-FUNC-03` | **P2** | Mentor / Media | Đồng bộ Signing Key media provider qua ConfigService. |
| **28** | `NEW-PRIV-01` | **P2** | B2B / Privacy | Chuyển CSV roster import sang gửi email invitation token. |
| **29** | `NEW-BILLING-01` | **P3** | Billing / Email | Phát sự kiện `billing.payment_succeeded` trong Stripe webhook. |
| **30** | `NEW-ARCH-01` | **P3** | Database / Clean | Tách cột JSON metadata riêng khỏi cột `pdfUrl`. |
| **31** | `NEW-DATA-01` | **P3** | Data / Timezone | Tính streak Flashcard theo múi giờ người dùng. |
| **32** | `NEW-INFRA-01` | **P3** | Nginx / Network | Chuẩn hóa Nginx map cho header Connection upgrade. |

---

## 3. CHECKLIST NGHIỆM THU SAU KHI SỬA (VERIFICATION GATES)

1. [ ] Xóa tài khoản thử nghiệm trên Stripe test mode -> Xác nhận webhook `customer.subscription.deleted` được kích hoạt.
2. [ ] Tạo 4 phiên phỏng vấn trên tài khoản Free -> Phiên thứ 4 phải trả về lỗi `402 Payment Required / Quota Exceeded`.
3. [ ] Đăng nhập tài khoản Admin chưa bật MFA -> Access token nhận được phải có `tokenType === 'mfa_enrollment'` và bị từ chối ở mọi route người dùng thường.
4. [ ] Bơm lỗi Redis giả lập khi submit câu hỏi thứ 5 -> Outbox worker phải tự động retry và tạo đủ Learning Path.
5. [ ] Khởi chạy Terraform plan -> Xác nhận task definition có đủ 7 biến môi trường secret từ Secrets Manager.
6. [ ] Tạo 5 request API đồng thời khi access token vừa hết hạn -> Client chỉ gọi 1 lần refresh và không bị force logout.
7. [ ] Gọi phân tích canvas diagram khi đã cấu hình OpenAI -> Xác nhận hệ thống gọi OpenAI Vision với dữ liệu hình ảnh thật thay vì MockVisionProvider hay chuỗi SVG rỗng.
8. [ ] Trò chuyện với Socratic Tutor -> Xác nhận nhận được phản hồi linh hoạt từ LLM theo ngữ cảnh câu hỏi.
9. [ ] Hoàn thành phiên phỏng vấn -> Xác nhận email tóm tắt kết quả được gửi thành công không bị crash `Missing "to" field`.
10. [ ] Kiểm tra biểu đồ Readiness -> Xác nhận phân bổ điểm đều cho các nhóm năng lực theo chủ đề câu hỏi, không bị dồn toàn bộ vào System Design.
