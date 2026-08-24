# Decision register

| ID | Quyết định | Trạng thái | Lý do |
|---|---|---|---|
| DEC-001 | Sản phẩm là nền tảng luyện tập, không ra quyết định tuyển dụng | Chốt | Giảm rủi ro pháp lý và giữ mục tiêu giáo dục |
| DEC-002 | Giữ NestJS/PostgreSQL/Prisma/Redis/BullMQ + React hiện tại | Chốt | Tận dụng kiến trúc và code đã có |
| DEC-003 | Modular monolith trước, tách service theo bằng chứng | Chốt | Giảm chi phí vận hành và coupling phân tán |
| DEC-004 | Text interview là luồng bắt buộc đầu tiên | Chốt | Dễ kiểm định chất lượng và accessibility |
| DEC-005 | Voice interview là Phase 2 | Chốt | Cần streaming, consent, retention và chi phí riêng |
| DEC-006 | Không phân tích cảm xúc/khuôn mặt hoặc phát hiện nói dối | Chốt | Không đáng tin cậy và rủi ro quyền cơ bản |
| DEC-007 | Admin bắt buộc MFA; candidate được khuyến nghị MFA | Chốt | Bảo vệ quyền cấu hình và dữ liệu diện rộng |
| DEC-008 | AI output phải structured, versioned và có rubric evidence | Chốt | Audit, eval và migration |
| DEC-009 | BullMQ/Redis là nền job async; PostgreSQL là source of truth | Chốt | Phù hợp ADR và code hiện tại |
| DEC-010 | Provider AI | Decision gate | Nghiên cứu chất lượng, giá, latency và data policy tại milestone |
| DEC-011 | Voice/STT/TTS provider | Decision gate | Chỉ chốt trước Phase 2 |
| DEC-012 | Cloud/IaC target | Decision gate | Thiết kế portable trước khi chọn AWS/Azure/GCP |
| DEC-013 | Billing/payment | Decision gate | Không cần cho learning MVP |
| DEC-014 | Trunk-based với protected `main` và short-lived branch | Chốt | Repo cá nhân hiện chỉ có `main`; giảm divergence |

Mọi thay đổi quyết định phải thêm ngày, người phê duyệt, lựa chọn thay thế, ảnh hưởng và kế hoạch migration.
