# Project charter

## Tuyên bố sản phẩm

AI IT Interview là nền tảng luyện phỏng vấn dành cho ứng viên công nghệ, cung cấp phiên phỏng vấn thích ứng, đánh giá có rubric và lộ trình cải thiện dựa trên bằng chứng.

## Kết quả mong muốn

- Ứng viên biết mình yếu ở kiến thức, giải thích, giải quyết vấn đề hay giao tiếp.
- Phản hồi nhất quán hơn giữa các lần luyện và có ví dụ cải thiện.
- Hệ thống an toàn, bảo trì được, đo được chất lượng AI và không tạo ảo tưởng về độ chính xác.
- Code hiện tại được nâng cấp tiến hóa, không viết lại toàn bộ thiếu bằng chứng.

## Người dùng chính

- Candidate: luyện tập và theo dõi tiến bộ.
- Content reviewer: quản lý taxonomy, rubric và bộ câu hỏi chuẩn.
- Platform admin: quản trị người dùng, cấu hình, AI quota và vận hành.
- Mentor: xem báo cáo do candidate chủ động chia sẻ; nằm sau MVP.

## Ranh giới đạo đức

- Đây là công cụ học tập, không phải hệ thống tuyển dụng hoặc xếp hạng ứng viên cho doanh nghiệp.
- Không suy luận cảm xúc, tính cách, giới tính, dân tộc, tình trạng sức khỏe hoặc khả năng nói dối từ audio/video.
- Không dùng AI làm nguồn duy nhất cho điểm số quan trọng.
- Cho phép người dùng xem rubric, evidence, uncertainty và yêu cầu đánh giá lại.

## Tiêu chí thành công cấp dự án

- Có đường đi hoàn chỉnh từ đăng ký đến learning plan.
- Score agreement với chuyên gia đạt ngưỡng đã định trên golden set.
- Không có BOLA/IDOR giữa người dùng.
- Có CI/CD, observability, backup, rollback và evidence cho release.
- Kiến trúc có thể tăng tải mà không buộc rewrite.
