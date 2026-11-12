# Quy Trình Triển Khai Cổng Thanh Toán Production (Payment Go-Live Checklist)

Tài liệu checklist và hướng dẫn từng bước kích hoạt cổng thanh toán trực tiếp (**Stripe Live Mode** và **PayOS VietQR**) cho môi trường Production của `AI Interview Practice`.

---

## 1. Stripe Live Mode Checklist

### Bước 1: Đăng Ký Tài Khoản & Hoàn Thành Định Danh (KYC)

- [ ] Đăng ký tài khoản doanh nghiệp hoặc cá nhân trên [Stripe Dashboard](https://dashboard.stripe.com/register).
- [ ] Điền đầy đủ thông tin định danh pháp lý (KYC):
  - Thông tin doanh nghiệp / cá nhân, mã số thuế, địa chỉ trụ sở.
  - Thông tin người đại diện theo pháp luật và giấy tờ tùy thân (CCCD/Hộ chiếu).
  - Tài khoản ngân hàng nhận tiền payout (IBAN / Routing Number / Swift Code).
- [ ] Bật xác thực 2 yếu tố (2FA) cho tất cả tài khoản quản trị Stripe.

### Bước 2: Tạo Khóa Live API (Live API Keys)

- [ ] Chuyển đổi công tắc từ **Test Mode** sang **Live Mode** trên thanh điều hướng Stripe.
- [ ] Điều hướng tới mục **Developers** → **API keys**.
- [ ] Tạo hoặc sao chép cặp khóa Live:
  - **Publishable Key**: dạng `pk_live_...` (dùng cho client-side / web).
  - **Secret Key**: dạng `sk_live_...` (dùng cho backend API).
- [ ] Lưu trữ Secret Key vào công cụ quản lý bí mật (AWS Secrets Manager / Doppler) hoặc file biến môi trường production an toàn.

### Bước 3: Cấu Hình Webhook Endpoint URL

- [ ] Điều hướng tới mục **Developers** → **Webhooks** → nhấp **Add endpoint**.
- [ ] Điền URL webhook production của backend:
  - Ví dụ: `https://api.yourdomain.com/api/v1/billing/stripe/webhook`
- [ ] Mô tả endpoint: `Production AI Interview Billing Webhook`.

### Bước 4: Đăng Ký Các Sự Kiện Webhook Cần Thiết

Đánh dấu chọn chính xác 4 sự kiện bắt buộc sau:

- [ ] `checkout.session.completed`: Kích hoạt khi người dùng hoàn tất thanh toán lượt mua hoặc bắt đầu subscription.
- [ ] `invoice.paid`: Kích hoạt khi hóa đơn chu kỳ subscription được thanh toán thành công (gia hạn tự động).
- [ ] `customer.subscription.updated`: Cập nhật trạng thái subscription (đổi gói, hủy vào cuối kỳ, thanh toán thử lại).
- [ ] `customer.subscription.deleted`: Thu hồi quyền lợi khi subscription bị hủy hoặc quá hạn thanh toán.

### Bước 5: Cấu Hình Webhook Signing Secret

- [ ] Sau khi tạo Webhook endpoint, nhấn vào endpoint vừa tạo, tìm mục **Signing secret**.
- [ ] Nhấp **Reveal** để lấy khóa bí mật dạng `whsec_...`.
- [ ] Cập nhật vào biến môi trường hệ thống:
  ```env
  STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
  STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
  STRIPE_LIVE_MODE=true
  STRIPE_PRO_MONTHLY_PRICE_ID=price_xxxxxxxxxxxx
  STRIPE_PRO_YEARLY_PRICE_ID=price_xxxxxxxxxxxx
  ```

### Bước 6: Kiểm Thử Webhook Bằng Stripe CLI

- [ ] Cài đặt Stripe CLI và đăng nhập:
  ```bash
  stripe login
  ```
- [ ] Kích hoạt giả lập sự kiện kiểm thử tới endpoint backend:
  ```bash
  stripe trigger checkout.session.completed --forward-to https://api.yourdomain.com/api/v1/billing/stripe/webhook
  ```
- [ ] Kiểm tra log backend: HTTP 200 OK trả về, bản ghi thanh toán được cập nhật vào database mà không lỗi chữ ký (signature verification).

---

## 2. PayOS VietQR Checklist

### Bước 1: Đăng Ký Tài Khoản Merchant PayOS

- [ ] Truy cập [PayOS Merchant Portal](https://payos.vn/) và tạo tài khoản doanh nghiệp / hộ kinh doanh.
- [ ] Hoàn thiện thông tin tài khoản ngân hàng thụ hưởng (VietQR Napas247).
- [ ] Xác thực danh tính doanh nghiệp (KYC) theo yêu cầu pháp lý của PayOS.

### Bước 2: Tạo Kênh Thanh Toán & Lấy Bộ Khóa Tích Hợp

- [ ] Vào mục **Kênh thanh toán** → Tạo kênh thanh toán mới cho hệ thống `AI Interview Practice`.
- [ ] Lấy bộ 3 thông tin định danh bí mật:
  - `Client ID`: Định danh ứng dụng của bạn.
  - `API Key`: Khóa gửi request tạo link/QR thanh toán.
  - `Checksum Key`: Khóa bí mật dùng để mã hóa HMAC_SHA256 kiểm tra tính toàn vẹn của webhook callback.
- [ ] Cập nhật vào cấu hình backend:
  ```env
  PAYOS_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  PAYOS_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  PAYOS_CHECKSUM_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```

### Bước 3: Cấu Hình Webhook Callback URL

- [ ] Trên PayOS Dashboard, tìm phần **Cấu hình Webhook** của kênh thanh toán.
- [ ] Điền Webhook URL callback của server:
  - Ví dụ: `https://api.yourdomain.com/api/v1/billing/payos/webhook`
- [ ] Xác nhận kiểm tra webhook test từ giao diện PayOS để đảm bảo endpoint trả lời HTTP 200.

### Bước 4: Kiểm Thử Toàn Diện Trên Môi Trường Sandbox

- [ ] Thiết lập chế độ Sandbox trên PayOS Portal.
- [ ] Thực hiện luồng thanh toán thử nghiệm:
  1. Tạo link thanh toán / order qua backend API.
  2. Quét mã QR sandbox trên giao diện bằng camera hoặc ứng dụng giả lập.
  3. Chọn chuyển khoản thành công trên màn hình thanh toán sandbox PayOS.
  4. Đảm bảo Backend nhận webhook, kiểm tra chữ ký checksum HMAC_SHA256 hợp lệ và cộng credit cho user.
- [ ] Sau khi nghiệm thu sandbox thành công, chuyển kênh thanh toán sang trạng thái **Production**.

### Bước 5: Kiểm Tra Trải Nghiệm VietQR Trên Mobile Banking Apps

- [ ] Khởi tạo một giao dịch thật với số tiền nhỏ (ví dụ 2.000 VNĐ hoặc 10.000 VNĐ).
- [ ] Kiểm tra hiển thị VietQR trên web/mobile:
  - Mã QR hiển thị chuẩn định dạng VietQR tiêu chuẩn Napas247.
  - Có đầy đủ nút **Tải ảnh QR** và **Sao chép nội dung chuyển khoản / Số tài khoản**.
- [ ] Dùng ít nhất 2 ứng dụng ngân hàng phổ biến (Vietcombank, Techcombank, MB Bank, TPBank) quét mã QR:
  - Ứng dụng ngân hàng phải tự động điền đúng: Ngân hàng thụ hưởng, Số tài khoản, Số tiền chính xác và Nội dung chuyển khoản duy nhất (Order code).
- [ ] Xác nhận giao dịch: Tiền về tài khoản merchant trong vòng 3-10 giây, webhook bắn về server và quyền lợi người dùng được kích hoạt tức thì.

---

## 3. Tiêu Chí Nghiệm Thu Trước Giờ G (Go-Live Gate Criteria)

| Hạng Mục                        | Yêu Cầu                                                                                       | Trạng Thái                                                                            |
| :------------------------------ | :-------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| **Bảo mật Webhook**             | Xác thực chữ ký cryptographic (Stripe Signature / PayOS Checksum) trước khi xử lý body        | [x] Đạt (Code: raw body HMAC-SHA256, timestamp tolerance, timing-safe equal)          |
| **Tính lũy đẳng (Idempotency)** | Lưu và kiểm tra `payment_intent_id` / `order_code` để chống xử lý trùng lặp khi webhook retry | [x] Đạt (Code: bảng stripe_events deduplication & durable invoice ledger status=PAID) |
| **Giám sát & Cảnh báo**         | Thiết lập Sentry và Slack alert khi có webhook thất bại hoặc lỗi xác thực                     | [x] Đạt (Code: fail-closed DomainException & Prometheus alert_rules configured)       |
| **Bảo vệ rò rỉ Key**            | Không commit bất kỳ Live Secret Key nào vào git repository                                    | [x] Đạt (Audited: .env.example chỉ chứa placeholder, secret scans pass)               |
