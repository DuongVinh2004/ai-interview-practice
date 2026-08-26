# F006 — Socratic AI Tutor & Instant Question Retry

## 1. Tổng quan

Tính năng "Socratic AI Tutor & Instant Question Retry" nhằm cung cấp một gia sư AI ảo đi kèm ở trang Kết quả (Result Page) của các phiên phỏng vấn. Thay vì chỉ cung cấp đáp án mẫu (Model Answer) một cách thụ động, AI Tutor sẽ áp dụng phương pháp giáo dục Socrates - gợi mở bằng câu hỏi để người dùng tự nhận ra điểm thiếu sót. Đồng thời, tính năng Instant Retry cho phép ứng viên ngay lập tức trả lời lại một câu hỏi cụ thể đã làm sai, được AI chấm điểm tức thì và so sánh sự tiến bộ.

## 2. Yêu cầu chức năng

| ID         | Tên chức năng                | Mô tả chi tiết                                                                                         | Mức độ     |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------ | ---------- |
| FR-TUT-001 | Nút "Ask AI Tutor"           | Hiển thị nút hỏi gia sư tại mỗi câu hỏi trong trang kết quả đánh giá.                                  | Cao        |
| FR-TUT-002 | Giao diện Chat Context-aware | Màn hình chat nhận biết sẵn ngữ cảnh (câu hỏi, câu trả lời của user, đáp án chuẩn, đánh giá hiện tại). | Cao        |
| FR-TUT-003 | Socratic Questioning         | AI không đưa ra câu trả lời trực tiếp mà sinh ra các câu hỏi gợi mở, phân tích Trade-off.              | Cao        |
| FR-TUT-004 | Instant Retry                | Cho phép người dùng ghi âm/gõ lại câu trả lời mới cho một câu hỏi cụ thể.                              | Cao        |
| FR-TUT-005 | Visual Comparison            | Giao diện side-by-side so sánh: Lần trả lời 1 vs. Lần trả lời 2 vs. Đáp án chuẩn.                      | Trung bình |
| FR-TUT-006 | Tracking Improvement         | Theo dõi sự cải thiện điểm số (ví dụ: Tăng từ 5/10 lên 8/10) sau khi Retry.                            | Cao        |
| FR-TUT-007 | Concept Map & References     | AI tự động tạo sơ đồ khái niệm và trích xuất link đến Documentations (React docs, MDN, v.v.).          | Trung bình |
| FR-TUT-008 | Đánh giá AI (Rate Tutor)     | Người dùng có thể Thumbs up/down và gửi feedback về chất lượng giải thích của AI.                      | Thấp       |

## 3. Yêu cầu phi chức năng

| ID          | Yêu cầu                      | Chỉ số mục tiêu (SLO)                                                                        |
| ----------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| NFR-TUT-001 | Thời gian phản hồi Chat      | Stream text response từ AI Provider < 1.5s TTFB (Time To First Byte).                        |
| NFR-TUT-002 | Thời gian chấm Instant Retry | Hoàn tất chấm điểm câu trả lời Retry < 5s (sử dụng model nhanh hơn so với batch evaluation). |
| NFR-TUT-003 | Lưu trữ ngữ cảnh             | Hỗ trợ Context window tối thiểu 16K tokens để nhét vừa lịch sử phỏng vấn.                    |

## 4. Thiết kế Kiến trúc

### System Diagram

```mermaid
graph TD
    UI[Frontend Client] -->|Chat Message / Retry Audio| Gateway[API Gateway]
    Gateway --> TutorService[Tutor Service]
    Gateway --> EvalService[Evaluation Service]

    TutorService -->|Fetch Context| DB[(PostgreSQL)]
    TutorService -->|Build System Prompt| AiProvider[AI Orchestrator]
    AiProvider -->|Streaming Response (SSE)| TutorService
    TutorService -->|SSE| UI

    EvalService -->|Evaluate Retry| AiProvider
    EvalService -->|Save Retry Result| DB
    EvalService -->|Return updated score| UI
```

### Chiến lược Prompting (Socratic Method)

System Prompt thiết kế theo mẫu:

- **Role:** You are a senior engineer mentoring a junior.
- **Rule:** Never give direct code or direct answers initially. Ask probing questions. Point out edge cases they missed (e.g., "What happens if the array is empty?").

## 5. Thiết kế CSDL (Prisma Schema)

```prisma
model TutorSession {
  id              String         @id @default(uuid())
  userId          String
  interviewId     String
  questionId      String

  messages        TutorMessage[]

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}

enum TutorRole {
  USER
  AI_TUTOR
  SYSTEM
}

model TutorMessage {
  id              String       @id @default(uuid())
  sessionId       String
  session         TutorSession @relation(fields: [sessionId], references: [id])
  role            TutorRole
  content         String       @db.Text

  // Trích dẫn hoặc link document nếu có
  references      Json?

  createdAt       DateTime     @default(now())
}

model QuestionRetry {
  id              String       @id @default(uuid())
  userId          String
  questionId      String       // Relate to original question
  interviewId     String       // Relate to original interview

  originalAnswer  String       @db.Text
  retryAnswer     String       @db.Text

  originalScore   Float
  retryScore      Float

  feedback        Json         // AI Feedback for retry

  createdAt       DateTime     @default(now())
}
```

## 6. Đặc tả API

### `POST /api/v1/tutor/sessions`

Khởi tạo một phiên Chat Socratic cho một câu hỏi.
**Request Body:**

```json
{
  "interviewId": "int-123",
  "questionId": "q-456"
}
```

**Response:** `201 Created` chứa `sessionId`.

### `POST /api/v1/tutor/sessions/:sessionId/chat`

Gửi tin nhắn chat, trả về dạng **Server-Sent Events (SSE)**.
**Request Body:**

```json
{
  "message": "Tôi vẫn chưa hiểu tại sao cách 1 lại gây Memory Leak?"
}
```

**Response Stream:** Text chunks.

### `POST /api/v1/evaluations/retry`

Gửi đáp án Retry.
**Request Body:**

```json
{
  "questionId": "q-456",
  "interviewId": "int-123",
  "answerText": "Theo tôi thì..." // Hoặc file URL nếu là audio
}
```

**Response:**

```json
{
  "retryId": "retry-789",
  "retryScore": 8.5,
  "improvement": 3.0,
  "feedback": "..."
}
```

## 7. Thiết kế Frontend

- **Floating Chat Widget:** Sử dụng Tailwind + Framer Motion trượt từ bên phải vào (Slide Over) khi bấm "Ask AI Tutor".
- **Streaming Chat:** Dùng thư viện `@microsoft/fetch-event-source` hoặc tích hợp sẵn của Vercel AI SDK để xử lý SSE streaming.
- **Diff Viewer:** Dùng `react-diff-viewer` để highlight điểm khác biệt giữa Câu trả lời gốc và Câu trả lời Retry (nếu gõ text).
- **Markdown Rendering:** Xử lý render code block và bảng biểu từ tin nhắn của AI (dùng `react-markdown` + `remark-gfm`).

## 8. Quản lý trạng thái (State Management)

- Dùng `Zustand` lưu trữ danh sách tin nhắn hiện tại để tránh re-render không cần thiết.
- Tích hợp Optimistic UI khi gửi tin nhắn chat, thêm thẻ tin nhắn nháp trước khi nhận phản hồi từ server.

## 9. Bảo mật & Phân quyền

- API Chat kiểm tra xem `userId` có quyền truy cập vào `interviewId` gốc không.
- Giới hạn độ dài tin nhắn (Max 1000 ký tự) để chống DoS bằng context token overflow.
- Giới hạn số lượng tin nhắn trong 1 Session (Max 20 turns) để kiểm soát chi phí API AI Provider.

## 10. Luồng xử lý lỗi (Error Handling)

- Đứt kết nối SSE: Client tự động thực hiện Exponential Backoff retry để khôi phục luồng stream.
- Content Moderation: AI Orchestrator Layer chặn các prompt injection hoặc câu hỏi không liên quan đến lập trình/phỏng vấn.

## 11. Số liệu & Đánh giá (Metrics & Monitoring)

- Đo lường số lượng Retry/Question.
- Độ dài trung bình của mỗi Tutor Session.
- Rating chất lượng (Thumbs up/down ratio) của câu trả lời AI.

## 12. Kế hoạch triển khai

- **Phase 1 (Tuần 1-2):** Xây dựng nền tảng Prompting Socratic và SSE Chat API.
- **Phase 2 (Tuần 3):** Implement UI Chat Widget và Markdown renderer.
- **Phase 3 (Tuần 4):** Xây dựng luồng Instant Retry (Chấm điểm đồng bộ trả kết quả nhanh).
- **Phase 4 (Tuần 5):** Thử nghiệm nội bộ (Dogfooding) để tinh chỉnh độ khó và phong cách gợi mở của AI Tutor.
