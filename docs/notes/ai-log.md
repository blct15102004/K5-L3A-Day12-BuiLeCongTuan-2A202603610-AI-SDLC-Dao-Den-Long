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
| **Phase 2** | Chuẩn hóa Contract v1.1, 3 Đêm, Gió Lạc, Bùa Gió, UI/HUD đầy đủ | ~52,000 | ~18,000 | ~$0.06 |
| **Phase 3** | Change Request Contract v1.2: Nhiên liệu đèn, Bóng hút `drain`, Thắng bình minh, Colorblind | ~38,000 | ~14,000 | ~$0.04 |

### 3. Phân tích lỗi & Điều chỉnh Harness (AI Error Log & Fixes)
- **Phase 1 — Lỗi shell PowerShell**: Dùng `&&` gây lỗi cú pháp trên Windows PowerShell. Đã sửa sang `;` và ghi vào `AGENTS.md`.
- **Phase 2 — Lỗi `node:fs` trong `src/core/constants.js`**: Ở Phase 1, `constants.js` import `node:fs` để đọc `game.contract.json`. Điều này khiến trình duyệt không thể load `src/core/` trực tiếp bằng ES Module. Đã viết lại `constants.js` thuần JS không import `node:*`, thêm test tự động `Browser Safety` trong `tests/runner.js` và ghi luật cấm vào `AGENTS.md`.
- **Phase 2 — Lỗi điểm xuất phát Đêm 3 & mặt đất hỗ trợ tầng 0**: Khi khởi chạy kiểm thử Đêm 3 không có scenario, tọa độ `(0,0,0)` nằm bên trong tầng 2 (`r<=8, Y=6`) và Tháp Chuông (`r<2`), khiến người chơi bị đẩy ra và rơi xuyên sàn. Đã phát hiện qua bài test `P2-MAP3` / `P2-PERF`, sửa điểm xuất phát Đêm 3 sang `[0, 0, -12]`, giới hạn va chạm Tháp Chuông ở `Y >= 5.5`, và bổ sung hàm `getSupportingGroundHeight` giữ mặt đất tầng 0 (`Y=0`) toàn đảo.
- **Cải tiến Harness**: Bổ sung skill `.agents/skills/verify-phase/SKILL.md` ép kiểm tra browser-safety, đồng bộ contract, tính tất định 3 đêm và benchmark trước mỗi lần gắn tag.
