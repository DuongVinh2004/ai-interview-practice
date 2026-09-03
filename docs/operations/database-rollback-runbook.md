# Runbook: Quy Trình Rollback Database Schema Production

Tài liệu hướng dẫn ứng phó khẩn cấp khi hệ thống ECS kích hoạt rollback hoặc migration database gặp sự cố.

---

## 1. Nguyên Tắc Cốt Lõi (Zero Data Loss Invariant)

1. **Tuân thủ Expand / Contract hai pha:**
   - Mọi migration thêm trường mới bắt buộc phải là nullable hoặc có giá trị mặc định (`DEFAULT`).
   - Tuyệt đối không xóa bảng (`DROP TABLE`), xóa cột (`DROP COLUMN`), đổi kiểu dữ liệu (`ALTER COLUMN TYPE`), hoặc thêm `SET NOT NULL` trong cùng pha release với application mới.
   - Pha Contract chỉ được kích hoạt ở release kế tiếp khi phiên bản application mới đã chạy ổn định ít nhất 24 giờ.

2. **Ứng phó khi ECS Application Rollback:**
   - Script `infra/scripts/promote-ecs-release.sh` tự động rollback ECS service về `old_api_task`.
   - Do migration đã qua kiểm duyệt Expand, application cũ vẫn hoạt động bình thường với schema mới (bỏ qua các cột/bảng mới được thêm vào).
   - **Tuyệt đối không chạy `prisma migrate reset` hoặc down migration phá hủy dữ liệu của người dùng.**

---

## 2. Các Bước Xử Lý Khẩn Cấp Khi Migration Thất Bại

### Bước 1: Dừng luồng ghi và xác định trạng thái Migration

```bash
# Kiểm tra trạng thái migration trên production
DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter api prisma migrate status
```

### Bước 2: Triage lỗi migration

- Nếu migration bị lỗi giữa chừng (`P3009: migrate found failed migrations`):
  1. Đăng nhập vào cơ sở dữ liệu tạm hoặc staging để tái hiện lỗi.
  2. Xác định câu lệnh SQL gây lỗi trong bảng `_prisma_migrations`.
  3. Đánh dấu migration đã resolve nếu schema thực tế không bị ảnh hưởng:
     ```bash
     DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter api prisma migrate resolve --rolled-back "<migration_name>"
     ```

### Bước 3: Phục hồi dữ liệu từ bản Snapshot nếu có hỏng dữ liệu

Nếu dữ liệu bảng bị hỏng (corrupted) trước khi phát hiện:

1. Kích hoạt quy trình Disaster Recovery:
   ```bash
   bash infra/scripts/restore-drill.sh
   ```
2. So sánh dữ liệu sai lệch giữa snapshot gần nhất và phiên bản hiện tại trước khi chuyển hướng traffic.
3. Thông báo cho Incident Commander và kích hoạt kênh liên lạc khẩn cấp theo chính sách SLO.
