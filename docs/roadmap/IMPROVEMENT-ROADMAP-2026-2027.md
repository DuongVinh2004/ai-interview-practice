# LỘ TRÌNH CẢI TIẾN & TIẾN HÓA KIẾN TRÚC ANYF (2026 - 2027)

> **Mục tiêu:** Nâng cấp năng lực kỹ thuật, độ an toàn sandbox thực thi mã nguồn, trải nghiệm tương tác AI và mở rộng tính năng doanh nghiệp cho nền tảng AnyF.

---

## Giai đoạn 1: Sandbox Hardening & Real-time Log Streaming (Q3/2026)

### 1.1. Ephemeral Docker Sandbox Runner (Stage B)
- **Mục tiêu:** Nâng cấp từ Local In-Memory Sandbox lên môi trường container Docker cô lập hoàn toàn cho các bài test phức tạp.
- **Tiêu chuẩn an toàn:**
  - Network isolation: `--network none` (chặn 100% traffic mạng ngoại vi và metadata cloud).
  - Least privilege: User non-root (`uid: 1000`), kích hoạt `no-new-privileges`, drop toàn bộ Linux capabilities (`--cap-drop ALL`).
  - Quotas: CPU 1.0 core (`--cpus 1.0`), RAM 512MB (`--memory 512m`), tmpfs 50MB (`--tmpfs /tmp:rw,noexec,nosuid,size=50m`).
  - Read-only root filesystem (`--read-only`).
  - Execution timeout: Hard kill sau 15 giây với tiến trình con (`process group SIGKILL`).

### 1.2. Server-Sent Events (SSE) & WebSocket Real-time Test Output
- **Mục tiêu:** Truyền trực tiếp dòng xuất log `stdout`/`stderr` từ runner về giao diện Monaco terminal khi ứng viên nhấn "Run Tests".
- **Kiến trúc:**
  - Backend mở SSE endpoint `GET /api/v1/arena/sessions/:id/events` hoặc WebSocket channel.
  - Test runner phát chunk output qua Redis Pub/Sub $\rightarrow$ SSE stream $\rightarrow$ Web Terminal hiển thị không bị giật lag.

### 1.3. Automated Challenge Pack Seeder & Validation CI
- **Mục tiêu:** Tự động hóa quy trình đóng gói và thẩm định bài tập mới.
- **Tính năng:**
  - CLI command `pnpm arena:validate --dir ./challenges/my-challenge`.
  - CI job chạy tự động 6 tầng validator trước khi cho phép merge challenge mới vào catalog.

---

## Giai đoạn 2: AI Coding Copilot, B2B Arena & Adaptive Skill Radar (Q4/2026)

### 2.1. AI Pairing Assistant & Formative Feedback (Phase P9)
- **Mục tiêu:** Cho phép ứng viên hỏi đáp gợi ý từ AI trong quá trình giải bài mà không làm lộ đáp án ẩn.
- **Cơ chế kiểm soát:**
  - Cung cấp 3 chế độ: `HINTS_ONLY` (chỉ gợi ý hướng tư duy), `EXPLANATION` (giải thích lỗi compiler/test), `PAIR_PROGRAMMING` (phản biện kiến trúc).
  - AI bị chặn truy cập file ẩn (`hiddenFiles`) và đáp án mẫu (`referenceSolution`).
  - Ghi nhận toàn bộ tương tác vào `ArenaActionEvent` làm bằng chứng đánh giá kỹ năng phối hợp AI.

### 2.2. B2B Enterprise Custom Challenge Authoring Portal
- **Mục tiêu:** Cung cấp cho khách hàng doanh nghiệp giao diện tạo và quản lý bài kiểm tra tuyển dụng riêng.
- **Tính năng:**
  - Trình soạn thảo manifest trực quan.
  - Phân quyền tổ chức (Organization Multi-Tenancy): Bài test của công ty A được bảo mật tuyệt đối khỏi công ty B.
  - Báo cáo đối soát ứng viên chuyên sâu (Executive PDF Report & Radar Breakdown).

### 2.3. Dynamic Adaptive Skill Graph & Radar Recommendations
- **Mục tiêu:** Tự động điều chỉnh độ khó và chủ đề bài luyện tập dựa trên điểm yếu của ứng viên.
- **Thuật toán:**
  - Trọng số suy giảm theo thời gian (Exponential Decay $\lambda = 0.01$/ngày).
  - Khi phát hiện một taxonomy key có điểm trung bình $< 70\%$, hệ thống tự động ưu tiên gợi ý các challenge liên quan trong danh mục tiếp theo.

---

## Giai đoạn 3: Enterprise MicroVMs & Advanced Anti-Cheat (2027)

### 3.1. Stage C MicroVM Isolation (Firecracker / gVisor)
- **Mục tiêu:** Cho phép chạy các bài tập kiến trúc phức tạp (multi-container microservices, database clusters, fullstack apps) với thời gian khởi động $< 150ms$.
- **Ưu điểm:**
  - Cô lập cấp độ phần cứng (Hardware-level KVM isolation).
  - Hỗ trợ đa ngôn ngữ và môi trường tùy biến cao mà không sợ rò rỉ bảo mật hệ thống host.

### 3.2. AI Anti-Cheat & Code Plagiarism Detection Engine
- **Mục tiêu:** Phát hiện gian lận, sao chép mã nguồn và can thiệp trái phép.
- **Cơ chế:**
  - Phân tích cú pháp trừu tượng (Abstract Syntax Tree - AST diff) để phát hiện code copy từ ChatGPT/StackOverflow.
  - Phân tích chuỗi sự kiện chỉnh sửa (`ArenaActionEvent`) để phát hiện việc paste code bất thường trong 1 giây.

### 3.3. Live Collaborative Engineering Arena (Multiplayer / Mentor Room)
- **Mục tiêu:** Phòng thực hành nhiều người cùng làm việc trong thời gian thực.
- **Ứng dụng:**
  - Mock Interview 1-on-1 giữa Mentor và Ứng viên (Mentor quan sát và đặt câu hỏi trực tiếp khi ứng viên đang code).
  - Hackathon & Team Challenge nội bộ cho doanh nghiệp.
