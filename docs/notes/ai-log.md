# Nhật ký Sử dụng AI & Quản lý Token (AI Log & Token Usage)

## Phase 1 — Đêm 1: Đảo Bến

### 1. Chiến lược tối ưu Token & SDLC
- Sử dụng mô hình theo đúng cấu hình cho việc lập trình logic và phân tích yêu cầu.
- Tách biệt rõ ràng giữa Core Logic và Visuals giúp viết unit test và headless scenario chạy độc lập, không cần gửi lại toàn bộ mã visual lớn vào prompt.
- Lập kế hoạch chi tiết trước khi code, duyệt rõ kiến trúc dữ liệu và contract v1.0.

### 2. Ước tính Token & Chi phí

| Phase | Lượt tương tác | Input Tokens (ước tính) | Output Tokens (ước tính) | Chi phí ước tính ($) |
|---|---|---:|---:|---:|
| **Phase 1** | Khởi tạo & Engine Core + Test Contract + 3D UI | ~45,000 | ~12,000 | ~$0.04 |

### 3. Phân tích lỗi & Điều chỉnh Harness (AI Error Log & Fixes)
- *Lỗi phát hiện*: Khi chạy lệnh cài đặt npm song song trên Windows PowerShell bằng cú pháp `&&`, shell bị lỗi cú pháp `The token '&&' is not a valid statement separator`.
- *Cách khắc phục & Cập nhật Harness*: Chuyển sang dấu `;` cho PowerShell, ghi chú rõ trong `AGENTS.md` về môi trường dòng lệnh Windows PowerShell để agent luôn sử dụng cú pháp hợp lệ.
