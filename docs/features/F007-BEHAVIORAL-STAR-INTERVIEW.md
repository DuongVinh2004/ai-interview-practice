# F007 — Behavioral Interview & STAR Method Assessment

## 1. Tổng quan
Module "Behavioral Interview & STAR Method Assessment" mở rộng khả năng của nền tảng để không chỉ đánh giá kỹ năng chuyên môn (Technical) mà còn đánh giá kỹ năng mềm (Soft-skills) và hành vi. Trọng tâm của module là ứng dụng mô hình STAR (Situation - Task - Action - Result) làm Rubric chuẩn mực. Hệ thống sẽ hỗ trợ ngân hàng câu hỏi chuẩn hành vi theo từng công ty (Google, Amazon...), lắng nghe câu trả lời, nhận diện cấu trúc STAR và đặt các câu hỏi đào sâu (Probing questions) dựa trên những thông tin ứng viên còn thiếu.

## 2. Yêu cầu chức năng

| ID | Tên chức năng | Mô tả chi tiết | Mức độ |
|---|---|---|---|
| FR-BEH-001 | Chế độ Phỏng vấn Hành vi | Bổ sung `SessionMode.BEHAVIORAL` vào core interview flow. | Cao |
| FR-BEH-002 | Ngân hàng câu hỏi Company-specific | Hỗ trợ preset bộ câu hỏi văn hóa (VD: 14 Leadership Principles của Amazon). | Cao |
| FR-BEH-003 | Phân tích STAR Real-time | AI phân tích câu trả lời và trích xuất 4 thành phần: S, T, A, R. Nhận diện phần nào bị thiếu hoặc mơ hồ. | Cao |
| FR-BEH-004 | Dynamic Probing Questions | AI tự động sinh câu hỏi phụ nếu phát hiện ứng viên bỏ sót. (VD: "Bạn chưa đề cập kết quả định lượng, hệ thống đã tăng bao nhiêu % hiệu năng?"). | Cao |
| FR-BEH-005 | Đánh giá Rubric Hành vi | Đánh giá theo thang điểm: Situation (0-4), Task (0-4), Action (0-4), Result (0-4), Structure (0-2). | Cao |
| FR-BEH-006 | Phân loại Competency | Gắn thẻ kỹ năng mềm: Lãnh đạo, Giải quyết xung đột, Quản lý thời gian, Teamwork. | Trung bình |
| FR-BEH-007 | Highlighting & Annotation | Giao diện report bôi màu các đoạn text ứng với S (Vàng), T (Xanh), A (Đỏ), R (Tím). | Cao |

## 3. Yêu cầu phi chức năng
| ID | Yêu cầu | Chỉ số mục tiêu (SLO) |
|---|---|---|
| NFR-BEH-001 | Tính đồng nhất đánh giá | Cùng một câu trả lời, sai số điểm AI đánh giá giữa 2 lần chạy < 5%. |
| NFR-BEH-002 | Thời gian sinh Probing | Độ trễ sinh câu hỏi đào sâu < 2.5s để đảm bảo cuộc hội thoại trôi chảy. |
| NFR-BEH-003 | Khả năng mở rộng NLP | Xử lý tốt các đoạn văn bản dài (ứng viên kể chuyện thường kéo dài 3-5 phút, tương đương 600-1000 từ). |

## 4. Thiết kế Kiến trúc

### System Diagram
```mermaid
graph TD
    A[Audio Input] -->|Whisper STT| B[Text Transcript]
    B --> C[Behavioral Interview Controller]
    
    C -->|Extract STAR Components| D[AI Orchestrator Layer]
    D --> E{Are components missing?}
    
    E -->|Yes (e.g., No Result)| F[Generate Probing Question]
    F --> G[TTS (Text-To-Speech)]
    G --> H[Play to User]
    
    E -->|No / Finished| I[Evaluation Service]
    I -->|STAR Rubric Scoring| J[(Database)]
```

## 5. Thiết kế CSDL (Prisma Schema)

```prisma
enum SessionMode {
  TECHNICAL
  BEHAVIORAL
  SYSTEM_DESIGN
}

model BehavioralQuestion {
  id              String       @id @default(uuid())
  content         String       @db.Text
  competencies    String[]     // e.g. ["LEADERSHIP", "CONFLICT_RESOLUTION"]
  companyPresets  String[]     // e.g. ["AMAZON", "GOOGLE"]
  createdAt       DateTime     @default(now())
}

model StarEvaluation {
  id              String       @id @default(uuid())
  answerId        String       @unique
  answer          Answer       @relation(fields: [answerId], references: [id])
  
  // Chứa text được trích xuất
  situationText   String?      @db.Text
  taskText        String?      @db.Text
  actionText      String?      @db.Text
  resultText      String?      @db.Text
  
  // Điểm số thành phần
  situationScore  Float
  taskScore       Float
  actionScore     Float
  resultScore     Float
  structureScore  Float
  
  totalScore      Float
  
  feedback        String       @db.Text
  
  createdAt       DateTime     @default(now())
}
```
*(Lưu ý: Bảng `Answer` ở core schema sẽ được mở rộng quan hệ 1-1 với `StarEvaluation`)*

## 6. Đặc tả API

### `POST /api/v1/interviews/behavioral/analyze-star`
API sử dụng nội bộ (hoặc giữa SessionController) để phân tích Transcript real-time và quyết định sinh câu hỏi probing.
**Request Body:**
```json
{
  "interviewId": "int-123",
  "questionId": "q-beh-01",
  "transcript": "Khi tôi làm ở dự án X, team đang bị trễ deadline trầm trọng..."
}
```
**Response:**
```json
{
  "starIdentified": {
    "situation": true,
    "task": true,
    "action": true,
    "result": false
  },
  "actionNeeded": "PROBE",
  "probeText": "Bạn đã giải quyết vấn đề thành công, vậy kết quả cụ thể mang lại là gì? Có số liệu đo lường được không?"
}
```

### `GET /api/v1/evaluations/:id/star-report`
Lấy chi tiết đánh giá STAR.

## 7. Thiết kế Frontend
- **STAR Annotation View:** Transcript được hiển thị dạng văn bản. Sử dụng thẻ `<mark>` với màu nền khác nhau để bôi đậm các câu văn được AI nhận diện là thuộc S, T, A, hoặc R. (Có chú thích Legend bên cạnh).
- **Radar Chart:** Sử dụng thư viện `Recharts` hoặc `Chart.js` vẽ biểu đồ Radar thể hiện điểm số 5 trục (Situation, Task, Action, Result, Structure) để user dễ hình dung sự cân bằng.
- **Company Selection UI:** Dropdown / Card grid cho phép user chọn "Phỏng vấn theo chuẩn Amazon" trước khi bắt đầu.

## 8. Quản lý trạng thái (State Management)
- Trong lúc phỏng vấn, Frontend sử dụng State Machine (VD: xstate hoặc useReducer) để kiểm soát luồng:
  `ASK_MAIN_QUESTION` -> `RECORDING` -> `ANALYZING` -> `ASK_PROBING` (Loop max 2 lần) -> `FINISHED`.

## 9. Bảo mật & Phân quyền
- Quản lý hạn mức thời lượng ghi âm: Chặn các file audio dài quá 5 phút để tránh quá tải dịch vụ STT.
- Chống lạm dụng API: Rate limiting trên endpoint `analyze-star`.

## 10. Luồng xử lý lỗi (Error Handling)
- Nếu AI trả về kết quả JSON phân tích STAR bị sai định dạng (Hallucination), Backend sử dụng Zod schema fallback, tự động retry lại prompt hoặc chuyển thẳng về trạng thái kết thúc câu hỏi (không probe nữa) để không block luồng phỏng vấn.

## 11. Số liệu & Đánh giá (Metrics & Monitoring)
- Tỉ lệ thành công của việc nhận diện STAR (Log các trường hợp AI fail).
- Mức độ phổ biến của các Company Presets (Amazon vs Google vs Meta).
- Thời lượng phỏng vấn hành vi trung bình so với kỹ thuật.

## 12. Kế hoạch triển khai
- **Phase 1 (Tuần 1):** Xây dựng bộ Taxonomy câu hỏi hành vi và Seed data cho PostgreSQL.
- **Phase 2 (Tuần 2-3):** Tuning AI Prompt để nhận diện chính xác 4 thành phần S, T, A, R qua các bộ dữ liệu test mẫu.
- **Phase 3 (Tuần 4):** Xây dựng logic Probing và Controller API.
- **Phase 4 (Tuần 5):** Cập nhật Frontend UI (Annotation, Radar chart).
- **Phase 5 (Tuần 6):** QA và release.
