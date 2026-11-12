# Hướng dẫn Cấu hình Domain & DNS cho Transactional Email (Resend)

Tài liệu hướng dẫn thiết lập và xác thực sending domain trên Resend cho hệ thống transactional email của `AI Interview Practice`.

---

## 1. Đăng ký Domain trên Resend Dashboard

1. Đăng nhập vào [Resend Dashboard](https://resend.com/domains).
2. Chuyển đến mục **Domains** trong thanh điều hướng bên trái.
3. Nhấp nút **Add Domain**.
4. Nhập tên domain gửi email:
   - **Root domain**: ví dụ `yourdomain.com` (phù hợp nếu dùng chung cho toàn bộ website và email).
   - **Subdomain (khuyến nghị)**: ví dụ `mail.yourdomain.com` hoặc `send.yourdomain.com` (giúp cô lập danh tiếng gửi email với domain chính).
5. Chọn Region gửi email gần người dùng nhất (ví dụ: `ap-southeast-1` Singapore hoặc `us-east-1`).
6. Nhấp **Add** để chuyển sang màn hình thông tin DNS records.

---

## 2. Thêm 3 Bản Ghi DNS Bắt Buộc

Truy cập trang quản trị DNS của nhà cung cấp tên miền (Cloudflare, Route53, Namecheap, GoDaddy, v.v.) và khai báo 3 bản ghi sau:

| Loại Record      | Tên (Host / Name)                             | Giá Trị (Target / Content)                                           | TTL         | Mục Đích                                     |
| :--------------- | :-------------------------------------------- | :------------------------------------------------------------------- | :---------- | :------------------------------------------- |
| **CNAME** (DKIM) | `resend._domainkey` _(hoặc token Resend cấp)_ | `feedback-smtp.us-east-1.amazonses.com`                              | Auto / 300s | Chữ ký số mã hóa xác thực nguồn gốc gửi thư  |
| **TXT** (SPF)    | `send` _(hoặc `@` nếu dùng root domain)_      | `v=spf1 include:amazonses.com ~all`                                  | Auto / 300s | Khai báo máy chủ được ủy quyền gửi thư       |
| **TXT** (DMARC)  | `_dmarc` _(hoặc `_dmarc.send`)_               | `v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com; aspf=r;` | Auto / 300s | Chính sách ứng phó khi thư thất bại SPF/DKIM |

> [!IMPORTANT]
> **Cloudflare DNS Proxying**: Đối với bản ghi CNAME của DKIM trên Cloudflare, **bắt buộc tắt proxy** (chọn chế độ **DNS Only / Grey Cloud**). Nếu bật Cloudflare Proxy (Orange Cloud), hệ thống Resend sẽ không thể phát hiện chữ ký CNAME.
>
> **Xử lý trùng lặp SPF**: Mỗi domain chỉ được phép có duy nhất **một** bản ghi SPF TXT. Nếu domain đã có SPF sẵn (ví dụ Google Workspace: `v=spf1 include:_spf.google.com ~all`), hãy gộp lại thành:
> `v=spf1 include:_spf.google.com include:amazonses.com ~all`

---

## 3. Xác Minh Domain trên Resend

1. Sau khi cập nhật các bản ghi DNS tại DNS provider, quay lại Resend Dashboard.
2. Nhấp nút **Verify DNS Records** (hoặc **Check status**).
3. Các bản ghi sẽ chuyển trạng thái từ `Pending` sang `Verified`.
4. Khi toàn bộ bản ghi đạt `Verified`, domain chuyển trạng thái thành **Active**.

> [!NOTE]
> Thời gian lan truyền DNS (DNS propagation) thông thường mất từ 2 đến 15 phút, tối đa có thể lên tới 24-48 giờ tùy vào TTL của nhà cung cấp DNS.

---

## 4. Cấu Hình Biến Môi Trường Trong `.env`

Cập nhật các biến cấu hình trong `.env` của ứng dụng:

```env
# Module B2: Transactional Email System
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_123456789_abcdefghijklmnopqrstuvwx
EMAIL_DEFAULT_FROM="AI Interview Practice <noreply@mail.yourdomain.com>"
```

- `RESEND_API_KEY`: API key tạo từ [Resend API Keys](https://resend.com/api-keys) với quyền `Sending access` (hoặc `Full access`).
- `EMAIL_DEFAULT_FROM`: Địa chỉ người gửi bắt buộc phải sử dụng domain đã được verify thành công ở Bước 3.

---

## 5. Kiểm Thử Gửi Thư

### 5.1 Kiểm thử qua cURL

```bash
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_123456789_abcdefghijklmnopqrstuvwx' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "AI Interview Practice <noreply@mail.yourdomain.com>",
    "to": ["your-test-email@gmail.com"],
    "subject": "Kiểm thử Transactional Email",
    "html": "<strong>Hệ thống email đã sẵn sàng hoạt động!</strong>"
  }'
```

Phản hồi thành công (HTTP 200):

```json
{
  "id": "49633902-1676-4532-bc9f-02e52f2541ea"
}
```

### 5.2 Kiểm thử qua Resend Node.js SDK / CLI

```javascript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: process.env.EMAIL_DEFAULT_FROM,
  to: ['candidate@example.com'],
  subject: 'Mã xác thực đăng nhập',
  text: 'Mã OTP của bạn là: 123456. Mã này có hiệu lực trong 5 phút.',
});

if (error) {
  console.error('Lỗi gửi email:', error);
} else {
  console.log('Email sent successfully, id:', data.id);
}
```

---

## 6. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

### 6.1 Domain chưa verify (Status: Pending / Unverified)

- **Nguyên nhân 1**: DNS chưa lan truyền toàn cầu. Kiểm tra bằng công cụ tra cứu DNS:
  ```bash
  dig +short CNAME resend._domainkey.yourdomain.com
  dig +short TXT yourdomain.com
  ```
- **Nguyên nhân 2**: Cloudflare bật HTTP Proxy (Orange cloud). Hãy tắt Proxy, chuyển về DNS Only.
- **Nguyên nhân 3**: Nhập thừa domain name trong mục Host/Name. Một số nhà cung cấp DNS (như Namecheap/GoDaddy) tự động thêm tên domain gốc vào sau, do đó chỉ điền `resend._domainkey` thay vì `resend._domainkey.yourdomain.com`.

### 6.2 Email rơi vào thư mục Spam / Junk

- **Kiểm tra độ tương thích SPF/DKIM**: Dùng công cụ [Mail-Tester](https://www.mail-tester.com) để chấm điểm spam score (mục tiêu tối thiểu 9/10).
- **DMARC alignment**: Đảm bảo địa chỉ Header `From:` trùng khớp với domain đã cấu hình SPF/DKIM.
- **Khởi động domain mới (Warmup)**: Domain mới tạo không nên gửi dồn dập hàng nghìn email trong ngày đầu tiên. Tăng dần số lượng gửi để xây dựng uy tín IP/domain với Gmail và Outlook.
- **Nội dung email**: Tránh sử dụng từ khóa spam, link rút gọn bí mật (bit.ly), hoặc tỷ lệ hình ảnh quá cao so với văn bản.

### 6.3 Giới hạn tần suất gửi (Rate Limits)

- Tài khoản Resend Free Tier bị giới hạn:
  - 100 email / ngày.
  - Tối đa 2 request / giây.
- **Giải pháp**:
  - Toàn bộ tác vụ gửi email trong ứng dụng phải đưa vào BullMQ Queue (`email-delivery-queue`) với cơ chế rate-limiting và exponential backoff.
  - Khi triển khai production với lượng người dùng lớn, nâng cấp gói Resend Pro và thiết lập Dedicated IP nếu cần thiết.

---

## 7. Tiêu Chí Nghiệm Thu Email Go-Live (Readiness Verification)

| Hạng Mục                         | Yêu Cầu                                                                                | Trạng Thái                                                                           |
| :------------------------------- | :------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| **Resilience & Backoff**         | BullMQ queue email với 3 lần retry và exponential backoff                              | [x] Đạt (Code: `attempts: 3`, `backoff: exponential`, `DEFAULT_DURABLE_JOB_OPTIONS`) |
| **Fail-Closed Protection**       | Không gửi email mock ở môi trường production                                           | [x] Đạt (Code: `ResendEmailProvider` & `EmailModule` config validation)              |
| **Template Validation**          | 6 templates React Email render song ngữ Việt/Anh chính xác                             | [x] Đạt (Code: `templates.spec.ts` 6/6 tests pass)                                   |
| **Biến môi trường .env.example** | Đầy đủ `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `EMAIL_DEFAULT_FROM` | [x] Đạt (Audited & verified)                                                         |
| **Xác thực DNS Domain**          | Cấu hình CNAME (DKIM), TXT (SPF), TXT (DMARC) trên DNS registrar và Resend Active      | [ ] Chờ Ops (Cần domain thật và thao tác trên registrar)                             |
