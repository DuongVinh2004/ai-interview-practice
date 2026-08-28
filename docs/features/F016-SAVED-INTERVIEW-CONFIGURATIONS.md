# F016: Saved Interview Configurations & Reusable Presets

> **Mã tính năng**: F016  
> **Trạng thái**: ✅ Hoàn thành & Verified  
> **Tác động**: Frontend (Setup Page), Backend (Interview Configuration Module, Interview Session Lifecycle), Contracts, Database (Prisma)  
> **Ước lượng**: 2–3 ngày

---

## 1. Tổng quan & Mục tiêu Nghiệp vụ

Tính năng **Saved Interview Configurations** (F016) giải quyết vấn đề ma sát khi người dùng phải liên tục chọn lại vị trí, cấp bậc, công nghệ và các thiết lập phỏng vấn mỗi lần luyện tập.

### Mục tiêu chính:

1. **Recent Configurations**: Tự động ghi nhận cấu hình sau mỗi buổi phỏng vấn được khởi tạo thành công; sử dụng cơ chế **SHA-256 fingerprint** để upsert, tăng `useCount` và cập nhật `lastUsedAt` thay vì tạo bản ghi rác.
2. **User Presets**: Người dùng có thể chủ động lưu cấu hình yêu thích thành preset có đặt tên, mô tả, tùy chọn ghim lên đầu danh sách, chỉnh sửa, đổi tên và xóa.
3. **Seamless Reuse**: Cho phép áp dụng preset hoặc recent configuration chỉ với 1 click để điền sẵn form thiết lập; người dùng vẫn hoàn toàn có quyền tinh chỉnh trước khi bắt đầu phỏng vấn.
4. **Immutable Configuration Snapshot**: Mỗi `InterviewSession` lưu trữ bản snapshot JSON bất biến chứa toàn bộ taxonomy resolved tại thời điểm bắt đầu. Việc chỉnh sửa hoặc xóa preset sau này tuyệt đối không làm ảnh hưởng đến dữ liệu lịch sử của phiên phỏng vấn cũ.

---

## 2. Kiến trúc Data Model & Database Schema

### Models Prisma (`apps/api/prisma/schema.prisma`)

```prisma
model InterviewConfigurationPreset {
  id               String          @id @default(uuid()) @db.Uuid
  userId           String          @map("user_id") @db.Uuid
  name             String          @db.VarChar(100)
  description      String?         @db.VarChar(255)
  jobRoleId        String          @map("job_role_id") @db.Uuid
  seniorityLevelId String          @map("seniority_level_id") @db.Uuid
  technologyIds    String[]        @map("technology_ids")
  sessionMode      SessionMode     @default(STANDARD) @map("session_mode")
  competencyArea   CompetencyArea? @map("competency_area")
  language         String          @default("vi") @map("language") @db.VarChar(10)
  totalTurns       Int             @default(5) @map("total_turns")
  isSandbox        Boolean         @default(false) @map("is_sandbox")
  blueprintId      String?         @map("blueprint_id") @db.Uuid
  isPinned         Boolean         @default(false) @map("is_pinned")
  useCount         Int             @default(0) @map("use_count")
  lastUsedAt       DateTime?       @map("last_used_at")
  fingerprint      String          @db.VarChar(64)
  createdAt        DateTime        @default(now()) @map("created_at")
  updatedAt        DateTime        @updatedAt @map("updated_at")

  user             User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobRole          JobRole         @relation(fields: [jobRoleId], references: [id], onDelete: Restrict)
  seniorityLevel   SeniorityLevel  @relation(fields: [seniorityLevelId], references: [id], onDelete: Restrict)
  sessions         InterviewSession[]

  @@unique([userId, name])
  @@index([userId, isPinned(sort: Desc), updatedAt(sort: Desc)])
  @@index([userId, fingerprint])
  @@map("interview_configuration_presets")
}

model RecentInterviewConfiguration {
  id               String          @id @default(uuid()) @db.Uuid
  userId           String          @map("user_id") @db.Uuid
  fingerprint      String          @db.VarChar(64)
  jobRoleId        String          @map("job_role_id") @db.Uuid
  seniorityLevelId String          @map("seniority_level_id") @db.Uuid
  technologyIds    String[]        @map("technology_ids")
  sessionMode      SessionMode     @default(STANDARD) @map("session_mode")
  competencyArea   CompetencyArea? @map("competency_area")
  language         String          @default("vi") @map("language") @db.VarChar(10)
  totalTurns       Int             @default(5) @map("total_turns")
  isSandbox        Boolean         @default(false) @map("is_sandbox")
  blueprintId      String?         @map("blueprint_id") @db.Uuid
  useCount         Int             @default(1) @map("use_count")
  lastUsedAt       DateTime        @default(now()) @map("last_used_at")
  createdAt        DateTime        @default(now()) @map("created_at")
  updatedAt        DateTime        @updatedAt @map("updated_at")

  user             User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobRole          JobRole         @relation(fields: [jobRoleId], references: [id], onDelete: Restrict)
  seniorityLevel   SeniorityLevel  @relation(fields: [seniorityLevelId], references: [id], onDelete: Restrict)

  @@unique([userId, fingerprint])
  @@index([userId, lastUsedAt(sort: Desc)])
  @@map("recent_interview_configurations")
}
```

---

## 3. Quy tắc Nghiệp vụ & Bảo mật

1. **Deterministic Fingerprint**:
   - Chuỗi chuẩn hóa: `jobRoleId|seniorityLevelId|sorted(technologyIds)|sessionMode|competencyArea|language|totalTurns|isSandbox|blueprintId`
   - Hash SHA-256 (64 ký tự hex).
2. **Scoping & IDOR Prevention**:
   - Tất cả truy vấn, cập nhật, xóa preset được lọc và gán chặt chẽ theo `req.user.id` lấy từ JWT.
   - Thao tác trên preset của người khác trả về `404 RESOURCE_NOT_FOUND`.
3. **Allowlist Configuration Fields**:
   - Chỉ cho phép các trường cấu hình được định nghĩa trong allowlist.
   - Tuyệt đối không lưu token, thẻ thanh toán, câu trả lời hoặc file raw vào preset/recent.
4. **Subscription Quota Enforcement**:
   - Free Tier: Tối đa 3 presets.
   - Pro Tier: Tối đa 20 presets.
   - Team / Enterprise: Tối đa 50 - 100 presets.
5. **Incompatibility Detection**:
   - Khi trả về danh sách preset/recent, hệ thống đối chiếu với taxonomy hiện tại. Nếu có role/level/tech bị vô hiệu hóa (`isActive: false`) hoặc mode không được phép trong gói cước, trả về `isCompatible: false` kèm mảng lý do cụ thể `incompatibilityReasons`.

---

## 4. API Endpoints Specification

| Phương thức | Endpoint                                       | Mô tả                                                                                 |
| :---------- | :--------------------------------------------- | :------------------------------------------------------------------------------------ |
| `GET`       | `/api/v1/interview-configurations/presets`     | Lấy danh sách presets của người dùng (ghim lên đầu, sắp xếp theo thời gian cập nhật). |
| `POST`      | `/api/v1/interview-configurations/presets`     | Tạo preset mới (kiểm tra giới hạn gói, tính hợp lệ taxonomy và chống trùng tên).      |
| `PATCH`     | `/api/v1/interview-configurations/presets/:id` | Cập nhật tên, mô tả, trạng thái ghim hoặc cấu hình của preset.                        |
| `DELETE`    | `/api/v1/interview-configurations/presets/:id` | Xóa preset (an toàn với các session lịch sử).                                         |
| `GET`       | `/api/v1/interview-configurations/recent`      | Lấy danh sách cấu hình gần đây nhất của người dùng.                                   |
| `POST`      | `/api/v1/interview-configurations/validate`    | Kiểm tra tính tương thích của cấu hình/preset với taxonomy và quyền gói tài khoản.    |

---

## 5. Frontend UX & Accessibility

- **Vị trí**: Nằm ngay đầu trang Setup Interview (`SetupInterviewPage.tsx`).
- **Giao diện**:
  - Tab chuyển đổi giữa **"Presets Đã Lưu"** và **"Gần Đây"**.
  - Thẻ preset hiển thị badge ghim, tên, mô tả, role, level, mode, chip công nghệ, thời gian sử dụng gần nhất.
  - Cảnh báo trực quan màu vàng nếu preset chứa phần tử taxonomy bị tạm ngưng.
  - Phím tắt và ARIA Accessibility (`role="tab"`, `aria-selected`, `aria-label`, focus trapping trong modal).

---

## 6. Chiến lược Testing & Verification

1. **Unit Tests Backend**:
   - Fingerprint generation độc lập với thứ tự mảng công nghệ.
   - Chặn vượt hạn mức preset theo gói cước (Free: 3).
   - Chặn trùng tên preset cho cùng một user.
   - Chặn IDOR khi cập nhật/xóa preset của user khác.
   - Snapshot persistence bất biến với đầy đủ metadata taxonomy.
2. **Integration Tests Backend**:
   - Khởi tạo session lưu snapshot và tự động upsert recent configuration.
3. **Frontend Component Tests**:
   - Render tab presets và recent.
   - Áp dụng cấu hình thành công vào form.
   - Cảnh báo incompatibility và modal tạo/sửa/xóa preset.
