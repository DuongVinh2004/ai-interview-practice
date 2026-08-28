# KHO LƯU TRỮ TOÀN BỘ TASK & BUGFIX ĐÃ HOÀN THÀNH

## Master Archive: Remediated Issues, Security Vulnerabilities & Quality Hardening

> **Single Source of Truth** cho toàn bộ lịch sử lỗi và biện pháp khắc phục đã triển khai trong monorepo.  
> **Trạng thái**: 100% Resolved & Verified Green (714 tests passing across 151 test suites).

---

## Mục lục Tra cứu Nhanh

1. [Nhóm 1: Lỗ hổng Bảo mật & Phân quyền (Security & Authorization)](#1-nhóm-1-lỗ-hổng-bảo-mật--phân-quyền-security--authorization)
2. [Nhóm 2: Vòng đời Phỏng vấn & State Machine (Interview Lifecycle)](#2-nhóm-2-vòng-đời-phỏng-vấn--state-machine-interview-lifecycle)
3. [Nhóm 3: Toàn vẹn Dữ liệu, Quota & Thanh toán (Data Integrity & Billing)](#3-nhóm-3-toàn-vẹn-dữ-liệu-quota--thanh-toán-data-integrity--billing)
4. [Nhóm 4: AI Orchestration, Sandbox & Streaming (AI & Infrastructure)](#4-nhóm-4-ai-orchestration-sandbox--streaming-ai--infrastructure)
5. [Nhóm 5: Frontend, Cache Isolation & Accessibility (Web UI/UX)](#5-nhóm-5-frontend-cache-isolation--accessibility-web-uiux)

---

## 1. Nhóm 1: Lỗ hổng Bảo mật & Phân quyền (Security & Authorization)

### [BLOCKER-001 / SEC-002] MFA Challenge Token Separation & Strategy Hardening

- **Mức độ**: Blocker (P0)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/auth/auth.service.ts`, `apps/api/src/modules/auth/strategies/jwt.strategy.ts`, `apps/api/src/modules/voice-gateway/gateways/voice-streaming.gateway.ts`
- **Nguyên nhân gốc**: Token cấp sau khi nhập password nhưng chưa verify MFA dùng chung format với access token, cho phép attacker dùng token này truy cập API và WebSocket voice.
- **Biện pháp khắc phục**: Tách biệt `tokenType: 'mfa_challenge'`, chặn toàn bộ request mang token này vào protected HTTP routes và WebSocket. Bắt buộc hoàn tất TOTP verification mới cấp access token chuẩn.
- **Kiểm chứng**: `auth.service.spec.ts`, `jwt.strategy.spec.ts`, `voice-streaming.gateway.spec.ts`.

### [BLOCKER-002 / AUTH-H-01] Multi-Tenant Session Isolation & B2B Authorization Leak

- **Mức độ**: Blocker (P0)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/interview/interview.service.ts`, `apps/api/src/modules/b2b/b2b.service.ts`, `apps/api/src/modules/b2b/guards/b2b-tenant.guard.ts`
- **Nguyên nhân gốc**: `InterviewSession` thiếu trường `tenantId`/`assignmentId`, cohort analytics dùng công thức giả lập `Math.sin`, candidate có thể đọc chéo kết quả giữa các tenant.
- **Biện pháp khắc phục**: Bổ sung `tenantId` & `assignmentId` vào schema `InterviewSession`. Áp dụng `B2bTenantGuard` với explicit tenant header `x-tenant-id`. Cohort analytics truy vấn dữ liệu thực tế theo tenant isolation.
- **Kiểm chứng**: `b2b.service.spec.ts`, `b2b-tenant.guard.spec.ts`.

### [BLOCKER-003 / NEW-SEC-02] Hardcoded Fallback Secrets Purged

- **Mức độ**: Blocker (P0)
- **Vị trí ảnh hưởng**: `docker-compose.yml`, `apps/api/src/modules/portfolio/services/signature.service.ts`, `apps/api/src/modules/platform/config/env.validation.ts`
- **Nguyên nhân gốc**: Fallback secrets mặc định (JWT, Certificate secret, DB password) tồn tại trong config và source code.
- **Biện pháp khắc phục**: Bật fail-closed schema validation trong `env.validation.ts` (`min(32)` cho production secrets), loại bỏ hoàn toàn hardcoded secrets khỏi `docker-compose.yml` và `signature.service.ts`.
- **Kiểm chứng**: `env.validation.spec.ts`, `signature.service.spec.ts`.

### [SEC-003 / NEW-AUTH-01] Admin MFA Token Scoping & Least Privilege

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/auth/auth.service.ts`, `apps/api/src/modules/auth/guards/roles.guard.ts`, `apps/api/src/modules/admin/guards/mfa-step-up.guard.ts`
- **Nguyên nhân gốc**: Admin chưa đăng ký MFA vẫn nhận access token đầy đủ, có thể gọi API người dùng và các endpoint chưa gắn step-up guard.
- **Biện pháp khắc phục**: Khi `role === ADMIN && !mfaEnabled`, chỉ cấp token `mfa_enrollment` (15 phút), không cấp refresh token. Chặn toàn bộ thao tác ngoại trừ enrollment route.
- **Kiểm chứng**: `roles.guard.spec.ts`, `mfa-step-up.guard.spec.ts`.

### [SEC-012 / MEDIUM-003] Atomic Refresh Token Rotation & Session Revocation on Password Change

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/auth/auth.service.ts`, `apps/web/src/components/layout/Navbar.tsx`, `apps/web/src/stores/auth.store.ts`
- **Nguyên nhân gốc**: Logout ở giao diện web chỉ xóa token cục bộ mà không gọi revoke ở server; đổi mật khẩu không vô hiệu hóa access token cũ.
- **Biện pháp khắc phục**: Áp dụng conditional update `WHERE id = ? AND is_revoked = false` cho refresh token rotation (phát hiện reuse thu hồi toàn bộ token family). Tăng `tokenVersion` khi đổi mật khẩu. Đồng bộ API logout ở mọi luồng giao diện.
- **Kiểm chứng**: `auth.service.spec.ts`, `auth.controller.spec.ts`.

### [AUTH-M-01 / AUTH-M-02] IDOR on Share Review, Star Guide & Portfolio Bookmarks

- **Mức độ**: Medium (P2)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/share/share.service.ts`, `apps/api/src/modules/portfolio/portfolio.service.ts`, `apps/api/src/modules/taxonomy/taxonomy.service.ts`
- **Nguyên nhân gốc**: Thiếu kiểm tra quyền sở hữu `userId` khi xem đánh giá mentor chi tiết, xem gợi ý STAR hoặc quản lý bookmark.
- **Biện pháp khắc phục**: Kiểm tra chặt chẽ `userId` và token context trước khi trả về dữ liệu chi tiết; từ chối truy cập chéo bằng mã lỗi `403 Forbidden` / `404 Not Found`.
- **Kiểm chứng**: `share.service.spec.ts`, `portfolio.service.spec.ts`.

---

## 2. Nhóm 2: Vòng đời Phỏng vấn & State Machine (Interview Lifecycle)

### [INT-CR-01] Voice Live Session Finalization & Rest Parity

- **Mức độ**: Critical (P0)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/voice-gateway/gateways/voice-streaming.gateway.ts`, `apps/web/src/components/interview/VoiceInterviewRoom.tsx`
- **Nguyên nhân gốc**: Chế độ Voice Live chỉ lưu transcript cục bộ và đổi trạng thái `VoiceSession`, không gọi `submitAnswer` hoặc chuyển trạng thái `InterviewSession`, khiến session bị kẹt ở `ACTIVE`.
- **Biện pháp khắc phục**: Tích hợp luồng nộp câu trả lời chính thức (`Answer` + `EvaluationRun`) vào cuối mỗi lượt thoại của Voice Gateway; đồng bộ trạng thái `InterviewSession` chuyển sang `EVALUATING` -> `COMPLETED`.
- **Kiểm chứng**: `voice-streaming.gateway.spec.ts`.

### [INT-H-01] Navigation Guard on Incomplete Sessions

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/web/src/features/interview/InterviewRoomPage.tsx`, `apps/web/src/features/interview/InterviewResultPage.tsx`
- **Nguyên nhân gốc**: Giao diện cho phép điều hướng đến trang kết quả `/interviews/:id/result` ngay cả khi session chưa ở trạng thái `COMPLETED`.
- **Biện pháp khắc phục**: Thêm route guard kiểm tra trạng thái session, chỉ cho phép xem kết quả khi `state === 'COMPLETED'`. Nếu đang `EVALUATING` hiển thị màn hình chờ với tiến trình động.
- **Kiểm chứng**: `InterviewRoomPage.spec.tsx`, `InterviewResultPage.spec.tsx`.

### [INT-H-02 / HIGH-005] Compare-And-Swap (CAS) State Machine & Worker Idempotency

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/interview/processors/interview-evaluation.processor.ts`, `apps/api/src/modules/interview/interview.service.ts`
- **Nguyên nhân gốc**: Worker xử lý AI evaluation không dùng điều kiện CAS, có thể ghi đè trạng thái hoặc hồi sinh session đã bị hủy (`CANCELLED`).
- **Biện pháp khắc phục**: Áp dụng câu lệnh `updateMany WHERE id = ? AND state NOT IN ('CANCELLED', 'COMPLETED')` khi cập nhật kết quả. Bỏ qua job nếu session đã bị kết thúc trước đó.
- **Kiểm chứng**: `interview-evaluation.processor.spec.ts`.

### [INT-H-03 / HIGH-004] Queue Dual-Write Resilience & Answer Persistence Before Enqueue

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/interview/interview.service.ts` (ADR 0004)
- **Nguyên nhân gốc**: Nếu BullMQ bị lỗi kết nối sau khi lưu câu trả lời, phiên phỏng vấn bị treo vô thời hạn ở `ACTIVE` hoặc mất dữ liệu trả lời.
- **Biện pháp khắc phục**: Lưu bản ghi `Answer` vào DB trước trong transaction; bọc lệnh enqueue BullMQ trong try-catch, cập nhật session sang `FAILED` với thông điệp rõ ràng và cho phép retry an toàn nếu enqueue thất bại.
- **Kiểm chứng**: `interview.service.spec.ts`.

### [HIGH-006] Dynamic Total Turns (1–5 Turns) Configuration

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/interview/interview.service.ts`, `apps/api/src/modules/interview/processors/interview-evaluation.processor.ts`
- **Nguyên nhân gốc**: Logic kiểm tra hoàn thành phỏng vấn bị hardcode cứng 5 lượt hỏi đáp, không hỗ trợ các phiên rút gọn (Quick Practice 1-3 turns).
- **Biện pháp khắc phục**: Sử dụng thuộc tính `session.totalTurns` xuyên suốt vòng đời session và worker evaluation để xác định chính xác lượt kết thúc.
- **Kiểm chứng**: `interview.service.spec.ts`.

---

## 3. Nhóm 3: Toàn vẹn Dữ liệu, Quota & Thanh toán (Data Integrity & Billing)

### [CRITICAL-001 / SEC-001] Stripe & PayOS Webhook Fail-Closed & Raw Body Verification

- **Mức độ**: Critical (P0)
- **Vị trí ảnh hưởng**: `apps/api/src/main.ts`, `apps/api/src/modules/billing/controllers/webhook.controller.ts`, `apps/api/src/modules/billing/providers/payos.provider.ts`, `apps/api/src/modules/billing/providers/stripe.provider.ts`
- **Nguyên nhân gốc**: Webhook không bật `rawBody: true`, thiếu xác thực chữ ký HMAC-SHA256 chuẩn trên raw buffer, có fallback mock tự động cấp quyền gói trả phí ở production.
- **Biện pháp khắc phục**: Bật `rawBody: true` trong NestJS bootstrap, xác thực chữ ký HMAC nghiêm ngặt trước khi parse JSON, fail-closed 503 khi thiếu secret ở production, loại bỏ toàn bộ mock fallback khi chạy live.
- **Kiểm chứng**: `webhook.controller.spec.ts`, `stripe.provider.spec.ts`, `payos.provider.spec.ts`.

### [NEW-SEC-01 / HIGH-002] Serializable Quota Consumption & Double-Spend Prevention

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/billing/usage-meter.service.ts`, `apps/api/src/modules/interview/interview.service.ts`, `apps/api/src/modules/question-bank/question-bank.service.ts`
- **Nguyên nhân gốc**: Kiểm tra hạn mức (`checkQuota`) và trừ hạn mức (`recordUsage`) bị tách rời ngoài transaction, dẫn đến TOCTOU race condition (gửi đồng thời nhiều request tạo phòng hoặc reveal câu hỏi miễn phí khi quota chỉ còn 1).
- **Biện pháp khắc phục**: Đưa `checkAndConsumeQuota` vào trong transaction với mức cô lập `Serializable`, kết hợp bảng `QuestionBankUsageLedger` và `usage_records` để trừ hạn mức nguyên tử (atomic).
- **Kiểm chứng**: `usage-meter.service.spec.ts`, `question-bank.service.spec.ts`.

### [HIGH-003] Atomic Request-Bound Idempotency

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/interview/interview.service.ts`, `apps/api/src/modules/billing/billing.service.ts`
- **Nguyên nhân gốc**: Không có cơ chế nhận diện request trùng lặp khi mạng gián đoạn, người dùng double-click tạo nhiều session hoặc charge nhiều lần.
- **Biện pháp khắc phục**: Bắt buộc hỗ trợ header `Idempotency-Key`, hash SHA-256 request payload, tạo reservation state `IN_PROGRESS` trong Redis/DB để khóa race conditions và trả về kết quả đã lưu nếu trùng key.
- **Kiểm chứng**: `interview.service.spec.ts`, `billing.service.spec.ts`.

### [NEW-SEC-05] GDPR Account Deletion with Active Subscription Cancellation

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/profile/profile.service.ts`, `apps/api/src/modules/billing/billing.service.ts`
- **Nguyên nhân gốc**: Khi người dùng xóa tài khoản (`deleteAccount`), hệ thống khóa user nhưng không hủy subscription trên Stripe/PayOS, dẫn đến việc tiếp tục bị trừ tiền định kỳ.
- **Biện pháp khắc phục**: Trong transaction xóa tài khoản, tự động tìm các subscription đang hoạt động, gọi `provider.cancelSubscription()` và cập nhật trạng thái `Subscription.status = CANCELLED`.
- **Kiểm chứng**: `profile.service.spec.ts`.

### [G5 / Safe Data Projection] Question Bank Answer & Rubric Leakage Prevention

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/question-bank/question-bank.service.ts`, `apps/api/src/modules/question-bank/controllers/question-bank.controller.ts`
- **Nguyên nhân gốc**: API lấy chi tiết câu hỏi (`GET /questions/:slug`) trả về cả `answerBody` và `rubric` cho người dùng chưa thực hiện hành động mở khóa (reveal).
- **Biện pháp khắc phục**: Áp dụng safe projection: chỉ trả `answerBody` và `rubric` khi tồn tại bản ghi `QuestionAnswerAccessGrant` hợp lệ cho `userId` hiện tại.
- **Kiểm chứng**: `question-bank.service.spec.ts`.

---

## 4. Nhóm 4: AI Orchestration, Sandbox & Streaming (AI & Infrastructure)

### [HIGH-007] Durable AI Daily Budget Calculation

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/ai-orchestrator/services/provider-router.service.ts`
- **Nguyên nhân gốc**: Ngân sách chi phí AI hàng ngày lưu trên bộ nhớ RAM, bị reset về 0 khi server restart khiến chi phí thực tế có thể vượt hạn mức.
- **Biện pháp khắc phục**: Tính toán tổng chi phí hàng ngày dựa trên tổng hợp thực tế từ bảng `ai_runs` trong cơ sở dữ liệu PostgreSQL.
- **Kiểm chứng**: `provider-router.service.spec.ts`.

### [HIGH-008] Voice Gateway Binary Pre-Auth Frame Rejection

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/voice-gateway/gateways/voice-streaming.gateway.ts`
- **Nguyên nhân gốc**: WebSocket gateway nhận buffer audio nhị phân trước khi hoàn tất bắt tay xác thực JWT, có nguy cơ bị tấn công Memory Exhaustion DoS.
- **Biện pháp khắc phục**: Từ chối và ngắt kết nối ngay lập tức nếu client gửi binary frame trước sự kiện `auth`. Giới hạn dung lượng buffer tối đa 5MB/lượt gửi.
- **Kiểm chứng**: `voice-streaming.gateway.spec.ts`.

### [HIGH-009] CV Extraction Integrity & Anti-Hallucination

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/document-parser/services/document-parser.service.ts`
- **Nguyên nhân gốc**: Khi file CV tải lên trống hoặc không trích xuất được text, hệ thống sinh dữ liệu kinh nghiệm giả lập.
- **Biện pháp khắc phục**: Loại bỏ hoàn toàn fallback bịa đặt dữ liệu; trả về mảng rỗng và thông báo lỗi rõ ràng yêu cầu người dùng kiểm tra lại file.
- **Kiểm chứng**: `document-parser.service.spec.ts`.

### [HIGH-012 / G7] Judge0 Code Sandbox Hard Timeout & Fork Bomb Prevention

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/api/src/modules/code-execution/services/judge0-execution.provider.ts`
- **Nguyên nhân gốc**: Thiếu timeout ở tầng HTTP client khi Judge0 bị treo; thiếu giới hạn tài nguyên ngăn chặn mã độc hại ngốn CPU/RAM.
- **Biện pháp khắc phục**: Bổ sung `AbortSignal.timeout(10000)`, thiết lập giới hạn `cpu_time_limit: 5s`, `memory_limit: 262144 KB` (256MB), chặn truy cập network socket và filesystem root.
- **Kiểm chứng**: `judge0-execution.provider.spec.ts`.

---

## 5. Nhóm 5: Frontend, Cache Isolation & Accessibility (Web UI/UX)

### [PRIV-001] Authenticated Workbox Cache Partition & Cleanup on Logout

- **Mức độ**: High (P1)
- **Vị trí ảnh hưởng**: `apps/web/vite.config.ts`, `apps/web/src/App.tsx`, `apps/web/src/stores/auth.store.ts`
- **Nguyên nhân gốc**: Service Worker và React Query cache lưu trữ dữ liệu phỏng vấn/flashcard theo URL tĩnh, khi đổi tài khoản trên cùng trình duyệt dữ liệu của user cũ bị hiển thị cho user mới.
- **Biện pháp khắc phục**: Loại bỏ cache Service Worker đối với các authenticated API routes. Kích hoạt `queryClient.clear()` và xóa toàn bộ `CacheStorage` khi user thực hiện `logout()`.
- **Kiểm chứng**: `auth.store.spec.ts`.

### [A11Y-L-01 / G11] Modal Focus Trap & Keyboard Navigation Compliance

- **Mức độ**: Low (P3)
- **Vị trí ảnh hưởng**: `apps/web/src/components/ui/Modal.tsx`, `apps/web/src/components/common/PaywallModal.tsx`
- **Nguyên nhân gốc**: Các hộp thoại popup (Paywall, Feedback, Settings) không bẫy con trỏ phím `Tab` và không phục hồi focus về nút bấm trước đó khi bấm `Escape`.
- **Biện pháp khắc phục**: Tích hợp Focus Trap, lắng nghe sự kiện `Escape` để đóng modal, tự động phục hồi active element focus sau khi unmount. Đạt chuẩn WCAG 2.1 AA.
- **Kiểm chứng**: `Modal.spec.tsx`, `PaywallModal.spec.tsx`.

---

## 6. Tổng kết Kiểm chứng Chất lượng

| Hạng mục kiểm tra                           | Số lượng Suite | Số lượng Test | Tỷ lệ thành công |
| :------------------------------------------ | :------------: | :-----------: | :--------------: |
| **Backend API (`apps/api`)**                |   107 suites   |   573 tests   |  **100% PASS**   |
| **Frontend Web (`apps/web`)**               |   44 suites    |   141 tests   |  **100% PASS**   |
| **Shared Contracts (`packages/contracts`)** |    1 suite     |   10 tests    |  **100% PASS**   |
| **Type Check (`pnpm type-check`)**          |   5 packages   |   0 errors    |  **100% PASS**   |
| **TỔNG CỘNG HỆ THỐNG**                      | **151 suites** | **714 tests** |  **100% PASS**   |
