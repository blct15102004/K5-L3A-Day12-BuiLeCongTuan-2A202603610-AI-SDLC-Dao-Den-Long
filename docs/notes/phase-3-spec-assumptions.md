# Phân tích Yêu cầu, Tiêu chí Nghiệm thu & Giả định — Phase 3 (TICKET-03, Contract v1.2)

## 1. Các thay đổi phá vỡ luật cũ & Lý do cập nhật test Phase 1–2

| Luật cũ (Phase 1–2) | Luật mới (Phase 3 / v1.2) | Ảnh hưởng tới bộ test cũ |
|---|---|---|
| Thắp đủ đèn thắng ngay (`all_lit`) | Chỉ thắng khi sống tới bình minh với `>= ceil(0.6 * total)` đèn sáng (`dawn_survived`) | Cập nhật test `REQ-08` từ kiểm tra thắng ngay sang kiểm tra `all_lit` không còn kết thúc ván sớm, và kiểm tra thắng/thua lúc hết giờ (`dawn_survived` vs `dawn`). |
| Đêm 1/2/3 dài `300/330/360 s` | Đêm 1/2/3 dài `240/270/300 s` | Cập nhật kỳ vọng thời gian trong test & `game.contract.json`. |
| Nạp đom đóm `+10đ`, thắp đèn `+100đ`, bỏ thưởng thời gian | Nạp `+5đ`, thắp mới `+100đ`, thắp lại `+40đ`, Pulse `drain` `+15đ`, thưởng bình minh `+50+floor(fuel)` / đèn sáng + `50*flames` | Cập nhật kỳ vọng điểm trong `REQ-04` (`10*5 + 100 = 150`). |
| Đèn sáng bất tử, bóng không vào vùng an toàn | Đèn tụt nhiên liệu `1/s`, dưới `30` mất vùng an toàn, bóng `wander` lại gần `<=2m` hút `5/s` (`drain`) | Cập nhật `P2-SAFE` giữ nguyên khi `fuel >= 30`, bổ sung test mới cho `fuel < 30`, `drain`, `refuel`, `lantern_out`, `relight`. |

## 2. Tiêu chí Nghiệm thu Phase 3

- **P3-FUEL**: Đèn mới thắp `fuel = 100`, giảm `1/60` mỗi tick; về `0` tắt đèn, phát `lantern_out`, giữ `ever_lit = true`. Đèn `ever_lit` chỉ cần `5` đom đóm để thắp lại (`relight: true`, `relit_count++`, `+40đ`). Tiếp nhiên liệu thêm `10 * used`, không vượt `100`, bỏ qua đèn đầy.
- **P3-DRAIN**: Đèn `fuel < 30` mất safe zone. Bóng `wander` nhắm đèn sáng `fuel < 30` gần nhất (nếu không có thì nhắm đèn tắt gần nhất); vào `<= 2m` chuyển `drain`, hút `5/60` mỗi tick (cộng dồn nhiều bóng), phát `fuel_drain` mỗi `60 tick`. Thoát `drain` khi Mây vào `<= 6m` (`chase`), trúng Pulse (`stunned`, `+15đ`), đèn tắt / `fuel >= 30` / khoảng cách `> 2m` (`wander`). Tiếp nhiên liệu lên `>= 30` đẩy bóng trong `6m` ra trong `<= 30 tick`.
- **P3-WIN**: Hết giờ & còn sống & `lit >= ceil(0.6 * total)` (`3/5`, `4/6`, `5/7`) → thắng `dawn_survived` + thưởng bình minh; không đủ đèn → thua `dawn`; hết Ngọn Lửa (kể cả đúng tick hết giờ) → thua `no_flames`.
- **P3-CAP**: `capacity = min(20, 10 + 2 * successful_lights)`, reset `0` mỗi Đêm (đèn `lit: true` từ scenario không tính).
- **P3-COLORBLIND**: Cài đặt lưu `localStorage`: viền/mắt Bóng Mực `#00B3FF`, cảnh báo UI `#FFFFFF` kèm `⚠`, đèn tắt nén chiều cao 20% + vết rách giấy, đèn `fuel < 30` + thanh nhiên liệu nhấp nháy `1 Hz`.
