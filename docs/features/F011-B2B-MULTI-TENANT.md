# F011 — B2B Multi-Tenant Dashboard

## 1. Tổng quan
Tính năng B2B Multi-Tenant Dashboard cho phép hệ thống "AI Interview Practice" mở rộng phục vụ cho các trường đại học, bootcamps và doanh nghiệp (Enterprise). Hệ thống áp dụng kiến trúc đa khách hàng (multi-tenant architecture) để cung cấp khả năng cô lập dữ liệu (tenant isolation), tùy chỉnh giao diện (branding) và quản lý người dùng theo từng tổ chức. Tính năng này cho phép các tổ chức quản lý question bank riêng, định nghĩa rubrics đánh giá, theo dõi tiến độ của học viên/ứng viên qua dashboard analytics, và tích hợp sâu với hệ thống nội bộ của họ qua API/SSO.

## 2. Yêu cầu chức năng (FR-B2B-NNN)

| ID | Feature | Mô tả chi tiết |
|---|---|---|
| FR-B2B-001 | Tenant Onboarding | Wizard khởi tạo tenant mới, cấu hình domain, thông tin liên hệ và gói dịch vụ. |
| FR-B2B-002 | Data Isolation | Đảm bảo tính cô lập dữ liệu giữa các tenant bằng Row-Level Security (RLS) trên PostgreSQL. |
| FR-B2B-003 | Role Hierarchy | Phân quyền RBAC theo cấp bậc: Tenant Admin → Instructor → Student/Candidate. |
| FR-B2B-004 | Custom Branding | Cho phép thiết lập logo, màu sắc chủ đạo, và custom domain hoặc subdomain. |
| FR-B2B-005 | Question Bank | Upload/quản lý question bank riêng tư (hỗ trợ import CSV, JSON, Excel). |
| FR-B2B-006 | Custom Rubric | Tạo và chỉnh sửa rubric đánh giá riêng biệt cho tenant. |
| FR-B2B-007 | Cohort Management | Tạo lớp học (cohort), quản lý danh sách học viên và gán instructor. |
| FR-B2B-008 | Bulk Import | Thêm học viên hàng loạt vào hệ thống và cohort thông qua file CSV. |
| FR-B2B-009 | Cohort Analytics | Dashboard thống kê trung bình điểm số, tỷ lệ hoàn thành, heatmap kỹ năng, và điểm yếu của cohort. |
| FR-B2B-010 | Assignments | Giao bài tập phỏng vấn với các cấu hình đặc thù (thời gian, question bank, rubric) và deadline. |
| FR-B2B-011 | Instructor Override | Instructor có thể xem lại bài phỏng vấn, ghi chú và ghi đè điểm số do AI chấm (override scores). |
| FR-B2B-012 | Tenant Billing | Hệ thống thanh toán theo tenant (seat-based hoặc usage-based). |
| FR-B2B-013 | API Integration | Cấp phát API keys cho tenant để tích hợp với hệ thống LMS/ATS nội bộ. |
| FR-B2B-014 | SSO Integration | Hỗ trợ đăng nhập SAML 2.0 hoặc OIDC riêng cho từng tenant. |
| FR-B2B-015 | Data Export | Cho phép Tenant Admin xuất dữ liệu phân tích và kết quả (CSV/PDF) định kỳ. |

## 3. Non-Functional Requirements (NFR-B2B-NNN)
- **NFR-B2B-001**: Tenant data isolation guarantee - 100% truy vấn dữ liệu phải chứa tenant context; không có rò rỉ dữ liệu chéo (cross-tenant data leakage).
- **NFR-B2B-002**: Multi-tenant query performance - Các truy vấn analytics trên cohort phải trả về kết quả dưới 2 giây với dataset lên đến 10,000 học viên.
- **NFR-B2B-003**: Tenant-specific rate limiting - Giới hạn API rate limit dựa trên gói dịch vụ của tenant (ví dụ: 100 req/min cho gói cơ bản).
- **NFR-B2B-004**: High Availability - Hỗ trợ SLA 99.9% cho các tính năng cốt lõi của Enterprise.

## 4. Architecture

Hệ thống sử dụng chiến lược **Shared Database with Row-Level Security (RLS)** để tối ưu chi phí và dễ dàng bảo trì, đồng thời đảm bảo an toàn dữ liệu.

```mermaid
architecture-beta
    group api(cloud)[NestJS API]
    group db(database)[PostgreSQL]
    
    service tenantMiddleware(server)[Tenant Middleware] in api
    service authGuard(server)[RBAC Auth Guard] in api
    service controller(server)[B2B Controllers] in api
    
    service tenantDb(server)[Tenant Data] in db
    service rls(server)[RLS Policies] in db

    tenantMiddleware:R --> authGuard:L
    authGuard:R --> controller:L
    controller:B --> rls:T
    rls:B --> tenantDb:T
```

**Data Isolation Flow:**
1. Request đến kèm theo `tenant-id` (qua header hoặc subdomain) và Bearer JWT.
2. `TenantContextMiddleware` xác thực tenant và user có thuộc tenant đó hay không.
3. Trong Prisma, sử dụng Prisma Client Extensions để tự động tiêm `tenantId` vào điều kiện truy vấn hoặc SET LOCAL `tenant_id` cho session DB để kích hoạt RLS.

## 5. Database Schema

### Prisma Schema (Trích lược)

```prisma
model Tenant {
  id              String   @id @default(uuid())
  name            String
  domain          String?  @unique
  brandingConfig  Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  members         TenantMember[]
  cohorts         Cohort[]
  questionBanks   TenantQuestionBank[]
  apiKeys         TenantApiKey[]
}

model TenantMember {
  id        String   @id @default(uuid())
  tenantId  String
  userId    String
  role      TenantRole // ADMIN, INSTRUCTOR, STUDENT
  
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  user      User     @relation(fields: [userId], references: [id])
  cohorts   CohortMember[]

  @@unique([tenantId, userId])
}

model Cohort {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  description String?
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  members     CohortMember[]
  assignments Assignment[]
}

model Assignment {
  id          String   @id @default(uuid())
  cohortId    String
  title       String
  deadline    DateTime?
  config      Json
  
  cohort      Cohort   @relation(fields: [cohortId], references: [id])
}

enum TenantRole {
  ADMIN
  INSTRUCTOR
  STUDENT
}
```

## 6. API Specifications

| Method | Endpoint | Mô tả | Authorization |
|---|---|---|---|
| POST | `/api/v1/tenants` | Tạo tenant mới (SuperAdmin) | System Admin |
| GET | `/api/v1/b2b/cohorts` | Lấy danh sách cohort của tenant | Tenant Admin, Instructor |
| POST | `/api/v1/b2b/cohorts/:id/members` | Thêm học viên vào cohort | Tenant Admin, Instructor |
| GET | `/api/v1/b2b/analytics/cohort/:id` | Thống kê phân tích cohort | Tenant Admin, Instructor |
| POST | `/api/v1/b2b/evaluations/:id/override` | Ghi đè điểm AI đánh giá | Instructor |

## 7. State Machine / Event Flow
*Quy trình giao bài tập và đánh giá:*
1. Instructor tạo Assignment.
2. Hệ thống tạo các `InterviewSession` ở trạng thái `PENDING` cho tất cả học viên trong Cohort.
3. Học viên thực hiện phỏng vấn (Trạng thái: `IN_PROGRESS` → `COMPLETED`).
4. AI đánh giá (Trạng thái: `AI_EVALUATED`).
5. Instructor review và override điểm nếu cần (Trạng thái: `HUMAN_REVIEWED`).

## 8. Security & Compliance
- Row-Level Security bảo vệ dữ liệu ở mức DB.
- Tenant API Keys được mã hóa bằng bcrypt/argon2 hoặc lưu dạng hash.
- Hỗ trợ WCAG 2.2 AA cho cổng học viên.
- Audit logging cho mọi hành động thay đổi dữ liệu cấu hình hoặc override điểm.

## 9. Integration Points
- SSO (SAML/OIDC) qua Passport.js cho Enterprise Tenant.
- Tích hợp BullMQ để xử lý job background: import user từ CSV, gửi email notification.

## 10. Testing Strategy
- E2E Tests: Giả lập 2 tenant khác nhau thực hiện thao tác đồng thời để kiểm tra Data Leakage.
- Unit Tests: Kiểm tra Prisma Extension xem `tenantId` có luôn được tự động append vào query không.

## 11. Rollout & Deployment
- Triển khai tính năng cho nội bộ (Beta) với một vài đối tác bootcamp.
- Feature flags: Bật/tắt tính năng theo gói tenant.

## 12. Appendices
- Hướng dẫn cấu hình SSO SAML.
- Mẫu CSV import user chuẩn.
