## Quy tắc ghi tài liệu audit

Mỗi khi thực hiện audit codebase (khảo sát schema, RLS, luồng dữ liệu,
kiến trúc hiện có, giới hạn kỹ thuật...) trước khi build tính năng mới:

- Ghi tóm tắt phát hiện chính vào `docs/architecture-notes.md`
  (tạo file nếu chưa có).
- Format: `## [ngày] - Audit: [tên chủ đề]` kèm gạch đầu dòng phát
  hiện, tên file/dòng liên quan, và kết luận/quyết định nếu có.
- KHÔNG xoá/ghi đè nội dung cũ trong file — chỉ append thêm mục mới.
- Commit file này cùng nhánh đang làm việc.

Mục đích: tránh phải audit lại từ đầu (tốn thời gian + token) mỗi khi
cần nhớ lại một quyết định kiến trúc đã có.
