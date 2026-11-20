# Phân tích Yêu cầu, Tiêu chí Nghiệm thu & Giả định — Phase 2 (TICKET-02: "Ba hòn đảo")

> **Contract Version**: `1.1`  
> **Tag nộp**: `phase-2`

---

## 1. Thay đổi so với Phase 1 & Lý do sửa test cũ

Ticket-02 chuẩn hóa toàn bộ thông số gameplay và mở rộng Test Contract từ `v1.0` lên `v1.1`. Các thay đổi ảnh hưởng trực tiếp đến thiết kế và bộ test Phase 1 gồm:

| Thông số / Luật | Phase 1 (v1.0) | Phase 2 (v1.1 chuẩn hóa) | Lý do cập nhật test cũ |
|---|---|---|---|
| `carry_capacity` | `5` | `10` | Cập nhật kịch bản nạp đầy và giới hạn nhặt đom đóm |
| `lantern_cost` | `3` | `10` | Cập nhật kịch bản thắp sáng đèn từ 3 lên 10 đom đóm |
| `pickup_radius` | `1.5 m` | `1.0 m` (+ `|ΔY| <= 1.5 m`) | Chặt chẽ hơn theo khoảng cách 3D nhiều tầng |
| `interact_radius` | `2.5 m` | `2.0 m` (chọn đèn gần nhất, id nhỏ hơn) | Sửa tọa độ đứng nạp đèn trong kịch bản test cũ (từ 23.5 -> 23.5 vẫn <= 2.0) |
| `pulse_cost` / `stun` / `cd` | `1` / `3.0 s` / `1.0 s` | `3` / `120 ticks (2.0 s)` / `3.0 s` | Sửa kịch bản `scenario_pulse.json` (carried >= 3) và kiểm tra thời gian choáng 120 tick |
| `pulse` push timing | Đẩy ngay tức thì `4.0 m` | Đẩy dần tổng `4.0 m` trong **15 tick đầu** (tâm 3D `chân + 0.8m`) | Cập nhật test pulse kiểm tra vị trí sau >= 15 tick |
| `safe_radius` | `4.0 m` | `6.0 m` (đẩy bóng ở trong ra trong tối đa 30 tick) | Mở rộng vùng an toàn và thêm test đẩy bóng từ bên trong |
| `shade_speed` / `hit_radius` | `3.5 m/s` / `1.2 m` | `4.0 m/s` (Đêm 3: `4.5 m/s`) / `1.0 m` | Cập nhật test va chạm bóng mực theo bán kính 1.0 m |
| `invuln_s` / `hit` recoil | `2.0 s` / không recoil | `1.5 s (90 ticks)` / bóng lùi `2.0 m` trong `60 ticks` | Kiểm tra trạng thái `recoil` và bất tử 90 tick |
| `fall_enabled` | `false` | `true` (`Y < -10`: -1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh + bất tử 90 tick) | Thêm kịch bản rơi khỏi đảo và thắng/thua trên đảo mới |
| Điểm đom đóm (`per_mote`) | Cộng `+10` khi **nhặt** | Cộng `+10` mỗi đom đóm **nạp vào đèn** | Sửa test nhặt đom đóm (điểm = 0 khi mới nhặt, +100 khi nạp 10 cái) |
| Điểm Tỏa Sáng (`per_stun`) | `+20` | `+5` (cộng cho mỗi con trúng chiêu kể cả đang choáng) | Cập nhật kỳ vọng điểm trong test pulse |
| Trạng thái Bóng Mực | `chase`, `stunned` | Bắt buộc 5 tên: `spawning`, `wander`, `chase`, `recoil`, `stunned` | Cập nhật enum và kịch bản phát hiện 12m / bỏ đuổi 18m |

---

## 2. Tiêu chí Nghiệm thu (Acceptance Criteria) cho Phần 1, 2, 3, 4

| Mã YC | Hạng mục | Tiêu chí kiểm chứng được ("Làm A thì thấy B") |
|---|---|---|
| **P2-MOVE** | Di chuyển, Nhảy, Lướt | - Nhấn `jump` khi `grounded=true`: `vel.y = 7.0`, chịu trọng lực `-20 m/s²`; không nhảy kép trên không.<br>- Nhấn `dash`: lướt `14 m/s` trong `12 tick`, giữ nguyên Y khi lướt trên không, hồi chiêu `90 tick`, phát event `dash {}`, không bất tử khi lướt. |
| **P2-FALL** | Rơi khỏi đảo (`Y < -10`) | Khi `Y < -10`: xảy ra 1 lần (bỏ qua bất tử), `-1` Ngọn Lửa, mất hết đom đóm, phát `player_hit {by:"fall", flames, dropped:0, lost}`. Nếu còn lửa: chờ 60 tick rồi hồi sinh tại điểm xuất phát, `vel=[0,0,0]`, `invuln=90 ticks`. Hết lửa: thua ngay (`no_flames`), không hồi sinh. |
| **P2-MOTE** | Đom đóm sinh & rơi | Bắt đầu 20 con tại 20 điểm khác nhau, trần 30; mỗi 240 tick sinh thêm 1 tại điểm trống. Đom đóm rơi khi bị đánh nằm vành `1.5–2.5 m`, `ttl = 480 ticks`, chỉ nhặt được từ tick sau khi sinh/rơi. |
| **P2-MAP1** | Đêm 1 — Đảo Bến | Đảo tròn bán kính 40 m, 5 đèn đúng tọa độ chuẩn, 24 điểm đom đóm, 12 điểm bóng mực bán kính 37 m (2 con tick 300, mỗi 480 tick 1 con, tối đa 6). |
| **P2-MAP2** | Đêm 2 — Đảo Cau | 2 đảo tròn r=28 m tâm `(0,0,0)` & `(70,0,0)` + cầu tre `x∈[26,44], z∈[-2,2]`; 2 bục nhảy `(20,0,18)` & `(50,0,-18)` phóng `vy=14, vh=24` về tâm đảo kia đáp an toàn; 6 đèn `L1..L6`; Bóng Mực sinh mỗi 420 tick (7s), tối đa 8; thời gian 330s. |
| **P2-MAP3** | Đêm 3 — Đảo Chuông | Đảo r=45 m 3 tầng (`Y=0`, vành khăn `Y=3` `r=12..24, z>0`, đĩa `Y=6` `r<=8`); vách đứng chặn đi lên; 2 dốc `30°, 150°` rộng 3m; bục nhảy `(0,3,13)` phóng `vy=12, vh=8` hướng `-Z` đáp tầng 2; Tháp chuông `r=2` ở tâm tầng 2 chặn di chuyển; 7 đèn `L1..L7`; gió mạnh mỗi 30s (báo trước 2s, thổi 5s đẩy `2 m/s`); Bóng Mực `4.5 m/s` sinh mỗi 360 tick, tối đa 10; thời gian 360s. |
| **P2-DRIFT** | Gió Lạc (Đêm 2 & 3) | Sinh tick `1200, 2400...` tối đa 2 con `D1, D2`; `idle (2 m/s)` → `chase (7 m/s)` khi `carried>=5 & d<=15m`; chạm `XZ<=1.2m` cướp `min(3, carried)` phát `drifter_steal`, chuyển `flee` 240 tick rồi `removed` (bỏ qua vùng an toàn đèn và bất tử); trúng Tỏa Sáng lúc `chase` → `flee` không cướp, lúc `flee` có đồ → thả đom đóm phát `drifter_drop` và biến mất sau 120 tick. |
| **P2-CHARM** | Bùa Gió (`C1`, `C2`) | Nhặt bùa phát `charm_picked`, hiệu lực `600 ticks`: chạy `7.2 m/s` và Lướt 0 hồi chiêu; hồi sinh sau `2700 ticks`. Đêm 2: `(35,0,0)`; Đêm 3: `(30,0,25)` & `(-30,0,25)`. |
| **P2-UI** | Chuỗi 3 Đêm, Pause, Cài đặt, Âm thanh, HUD, Bảng màu | Menu chính → Giới thiệu Đêm (lời Ông Đăng) → Chơi Đêm 1/2/3 → Thắng Đêm 3 hiện màn hình Bình Minh + tổng điểm; Tạm dừng (`Esc/P`) dừng toàn bộ `sim_tick`/timer và ghi `state:"paused"`; Lưu âm lượng & độ nhạy chuột vào `localStorage`; Âm thanh đầy đủ các sự kiện + đếm ngược 10s cuối; HUD đủ 10 ô đom đóm, hồi chiêu, nhắc `E`, mũi tên chỉ đèn ngoài màn hình; Bảng màu đúng chuẩn RGB và ánh sáng `0.15 + 0.55*(lit/total)`. |
| **P2-CONTRACT** | Test Contract v1.1 & Hiệu năng | `game.contract.json` v1.1 đầy đủ tuning mới; `--night 1|2|3`; Snapshot & Event schema v1.1 đầy đủ; Chạy full 21,600 tick xong trong `<= 30 giây`; Regression Phase 1 đạt 100%. |

---

## 3. Các Giả định Hợp lý (Assumptions)

1. **Trạng thái `spawning` của Bóng Mực sinh tự nhiên**: Bóng Mực mới sinh theo lịch (`tick 300 + k*interval`) bắt đầu ở trạng thái `spawning` trong `30 ticks` (0.5 giây) rồi chuyển sang `wander` (sau đó ở bước 8 sẽ chuyển `chase` nếu Mây ở trong 12 m). Bóng Mực đặt từ file `scenario` mặc định ở trạng thái `chase` nếu `distXZ(shade, player) <= 12.0` hoặc `wander` nếu ở xa hơn (trừ khi scenario chỉ định rõ `state`).
2. **Sự kiện `night_start`**: Được ghi ở `tick: 0` ngay sau snapshot tick `0`: `{"type":"event","tick":0,"name":"night_start","data":{"night":n}}`.
3. **Đọc `state` của Gió Lạc khi đã `removed`**: Gió Lạc sau khi hết thời gian `flee` chuyển sang `state: "removed"` với `stolen: 0`, vẫn có mặt trong mảng `drifters` của snapshot để test kiểm chứng chuyển trạng thái, nhưng không tính vào giới hạn tối đa 2 con đang hoạt động khi xét sinh thêm ở tick `1200k`.
4. **Gia tốc chuyển động**: Ticket quy định "tăng tốc/dừng trong <= 0.1 s" (<= 6 ticks). Để giữ phản hồi điều khiển sắc bén và khớp tính toán hành trình chuẩn của headless test, Mây đạt vận tốc mục tiêu ngay trong 1 tick (`1/60 s <= 0.1 s`).
5. **Điểm trúng Tỏa Sáng và va chạm trên Đêm 3 nhiều tầng**: Bóng Mực di chuyển theo phương ngang bám theo độ cao mặt đất hiện tại tại `(x, z)` (cộng offset tâm `0.8 m`), giúp Mây và Bóng Mực trên cùng tầng có độ cao chênh lệch `<= 1.5 m`. Bục nhảy và dốc không chặn Bóng Mực hoặc Gió Lạc bay lướt qua, nhưng Tháp Chuông ở tâm tầng 2 (`r = 2.0 m`) chặn cả người chơi và Bóng Mực.
6. **Gió mạnh ở Đêm 3**: Bắt đầu chu kỳ 30s (`1800 ticks`): cảnh báo `wind.warning` tại `simTick = 1680` (báo trước 2s = 120 ticks), kích hoạt `wind.active = true` từ `simTick = 1800` đến `2099` (5s = 300 ticks) rồi tắt, lặp lại mỗi 1800 ticks.
