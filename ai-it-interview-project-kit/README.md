# AI IT Interview Project Kit

Project kit này là nguồn đặc tả chính thức để phát triển nền tảng luyện phỏng vấn IT bằng AI từ repository `DuongVinh2004/ai-interview-practice`.

## Mục tiêu

Xây một sản phẩm luyện phỏng vấn gần mức thương mại, giúp ứng viên:

- Chọn vị trí, cấp độ, công nghệ và mục tiêu luyện tập.
- Thực hiện phiên phỏng vấn có cấu trúc bằng tiếng Việt hoặc tiếng Anh.
- Nhận điểm theo rubric, bằng chứng từ câu trả lời và phản hồi có thể hành động.
- Theo dõi tiến bộ, điểm yếu và kế hoạch học tập cá nhân hóa.

Sản phẩm không được dùng điểm AI làm quyết định tuyển dụng tự động. Phân tích cảm xúc, khuôn mặt, giọng nói để suy luận tính cách và phát hiện nói dối nằm ngoài phạm vi.

## Trạng thái tài liệu

- **MVP (M0–M5)**: ✅ Đã triển khai — xem `PROJECT-STATUS.md` tại root repo để biết chi tiết.
- **Phase 2+ Features**: 📋 Đặc tả xong, chưa triển khai — xem `docs/features/FEATURE-ROADMAP-INDEX.md`.
- **Project Kit**: Source-of-truth cho domain rules, requirements, architecture của MVP.

## Cách bắt đầu

1. Đọc `../PROJECT-STATUS.md` để biết cái gì đã làm xong và cái gì chưa.
2. Đọc `00-start-here/PROJECT-CHARTER.md` để hiểu mục tiêu dự án.
3. Đọc `00-start-here/REPOSITORY-BASELINE.md` để phân biệt trạng thái hiện tại và trạng thái mục tiêu.
4. Đọc `00-start-here/DECISION-REGISTER.md` trước khi thay đổi kiến trúc hoặc phạm vi.
5. Tra requirement trong `03-requirements/` và contract trong `07-contracts/`.
6. Với feature mới (Phase 2+), đọc `../docs/features/IMPLEMENTATION-GUIDE.md`.

## Bản đồ thư mục

| Thư mục               | Nội dung                                                      | Trạng thái  |
| --------------------- | ------------------------------------------------------------- | ----------- |
| `00-start-here`       | Điều lệ, baseline repo, quyết định, thuật ngữ và nguồn        | ✅ Active   |
| `01-product`          | Tầm nhìn, người dùng, phạm vi, mô hình sản phẩm và KPI        | ✅ Active   |
| `02-domain`           | Domain, state machine, taxonomy, đánh giá và learning path    | ✅ Active   |
| `03-requirements`     | Functional, non-functional, compliance và acceptance criteria | ✅ Active   |
| `04-ux`               | Kiến trúc thông tin và luồng trải nghiệm                      | ✅ Active   |
| `05-architecture`     | Kiến trúc mục tiêu, module, scale, IaC và ADR                 | ✅ Active   |
| `06-data`             | Mô hình dữ liệu, index, retention và migration                | ✅ Active   |
| `07-contracts`        | API, event, async job, lỗi và compatibility                   | ✅ Active   |
| `08-ai-evaluation`    | AI boundary, prompt, rubric, eval và safety                   | ✅ Active   |
| `09-security-privacy` | Auth, IAM, threat model, privacy và secure SDLC               | ✅ Active   |
| `10-testing`          | Chiến lược test, quality gate, performance và accessibility   | ✅ Active   |
| `11-delivery`         | Roadmap, backlog, Git, team ownership và release gate         | ✅ Active   |
| `12-exec-plans`       | Quy chuẩn và kế hoạch thực thi (M0, M1, M4)                   | ✅ Active   |
| `13-operations`       | CI/CD, observability, SLO, backup và incident runbook         | ✅ Active   |
| `14-sample-data`      | Dữ liệu synthetic, rubric, session và AI eval cases           | ✅ Active   |
| `15-quality-evidence` | Traceability, scorecard, evidence và demo acceptance          | ✅ Active   |
| `_archived/16-codex`  | ChatGPT Supervisor Protocol (workflow cũ, không còn sử dụng)  | 🗄️ Archived |

## Nguyên tắc bất biến

- AI tạo câu hỏi và đề xuất đánh giá; rubric và evidence kiểm soát kết luận.
- Điểm phải truy vết đến tiêu chí và đoạn trả lời cụ thể.
- Không bịa trạng thái hoàn thành khi code hoặc test chưa có.
- Không lưu hoặc log mật khẩu, token, API key, OTP, CV hay câu trả lời nhạy cảm ngoài nhu cầu.
- Mọi dữ liệu mẫu trong kit là synthetic.
- Provider AI, voice provider, cloud provider và billing provider là decision gate.
