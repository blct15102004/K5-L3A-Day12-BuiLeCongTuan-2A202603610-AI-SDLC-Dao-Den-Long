# Phân tích Yêu cầu, Tiêu chí Nghiệm thu & Giả định (Phase 1 / PRD-0)

## 1. Bảng phân tích yêu cầu (PRD-0) & Tiêu chí nghiệm thu

| Mã YC | Nội dung yêu cầu PRD-0 | Tiêu chí nghiệm thu (Acceptance Criteria) | Cách kiểm chứng |
|---|---|---|---|
| **REQ-01** | Hòn đảo tròn Đêm 1 có 5 Đèn Lồng Lớn | Khởi tạo đảo tròn (bán kính 40m). Đủ 5 đèn (L1..L5) tại vị trí bán kính 25m. | Test khởi tạo, snapshot tick 0 có đủ 5 đèn |
| **REQ-02** | Di chuyển nhân vật Mây & camera 3D | Nhận `move: [x, z]` và `cam_yaw_deg`. Biến đổi góc quay theo công thức $x' = x\cos\theta + z\sin\theta$, $z' = -x\sin\theta + z\cos\theta$. Tốc độ chuẩn `player_speed` (6.0 m/s). | Scenario test di chuyển, so sánh tọa độ |
| **REQ-03** | Đom đóm (Motes) rải rác & Nhặt | Đom đóm nằm trên đảo. Khi người chơi tới gần $\le pickup\_radius$ (1.5m), nếu `carried < carry_capacity` (5) thì nhặt được. Phát event `mote_picked`, cộng điểm `score.per_mote`. | Scenario test nhặt đom đóm, kiểm tra event & điểm |
| **REQ-04** | Nạp ánh sáng vào đèn để thắp | Khi ở trong $\le interact\_radius$ (2.5m) quanh đèn chưa thắp, nhấn `interact` (rising edge), nạp tối đa số đom đóm mang theo cho đến khi đủ `lantern_cost` (3). Phát event `deposit`. Khi đủ nạp -> `lantern_lit`, cộng điểm `score.per_lantern`. | Scenario test nạp đèn & thắp sáng |
| **REQ-05** | Bóng Mực (Shade) xuất hiện & đuổi | Bóng Mực di chuyển hướng về Mây với tốc độ `shade_speed` (3.5 m/s). Khi chạm $\le shade\_hit_radius$ (1.2m), Mây mất 1 flame, rơi đom đóm theo `hit_drop_ratio` (0.5), nhận bất tử `invuln_s` (2.0s). Phát event `player_hit`. | Scenario test Bóng Mực truy đuổi & va chạm |
| **REQ-06** | Tỏa sáng (Pulse) xua đuổi Bóng Mực | Nhấn `pulse` khi có đủ `pulse_cost` (1 đom đóm) và hết cooldown `pulse_cooldown_s` (1.0s): tiêu tốn 1 đom đóm, đẩy lùi Bóng Mực trong $\le pulse\_radius$ (5.0m) lùi ra `pulse_push_m` (4.0m) và làm choáng `pulse_stun_s` (3.0s), chuyển state sang `"stunned"`. Phát event `pulse` kèm `stunned_ids`. Cộng điểm `score.per_stun`. | Scenario test tỏa sáng, kiểm tra stun & push |
| **REQ-07** | Vùng an toàn của Đèn (Safe Radius) | Đèn đã thắp tạo vùng an toàn bán kính `safe_radius` (4.0m). Bóng Mực không thể tiến vào trong vùng này (bị chặn ở rìa bán kính). | Scenario test Bóng Mực bị chặn bởi đèn sáng |
| **REQ-08** | Điều kiện Thắng & Thua | - Thắng: Khi cả 5 đèn đều sáng (`all_lit`). Điểm cộng thêm theo giây còn lại và số flame còn lại. Phát `game_over` `{"result": "won", "reason": "all_lit"}`.<br>- Thua: Khi `flames <= 0` (`no_flames`) hoặc hết giờ `time_left_s <= 0` (`dawn`). Phát `game_over` `{"result": "lost", ...}`. | Scenario test thắng và thua |
| **REQ-09** | Tính tất định (Determinism) | Cùng `--seed`, cùng scenario và inputs thì 2 lần chạy cho ra file output JSONL giống nhau 100% từng byte. | Chạy 2 lần so sánh SHA256 / diff |
| **REQ-10** | Giao diện 3D & HUD chơi lại | Hiển thị 3D góc nhìn thứ 3 với Three.js, Mây đội nón lá, đèn lồng phát sáng, sương đêm, HUD hiển thị flames/motes/đèn/thời gian/điểm, nút Chơi lại khi Thắng/Thua. | Kiểm tra mở UI trên trình duyệt |

---

## 2. Các giả định làm rõ (Assumptions for Ambiguities)

1. **Chi phí Tỏa sáng (`pulse_cost = 1`)**:
   - *Yêu cầu PRD-0*: "tốn ánh sáng".
   - *Giả định*: Tiêu tốn 1 đom đóm đang mang theo (`player.carried >= pulse_cost`). Nếu người chơi không mang đom đóm nào (`carried == 0`), kỹ năng tỏa sáng không kích hoạt.
2. **Vùng an toàn của Đèn (`safe_radius = 4.0m`)**:
   - *Yêu cầu PRD-0*: "Bóng Mực sợ những chiếc đèn."
   - *Giả định*: Chỉ những chiếc đèn **đã được thắp sáng** (`lit: true`) mới phát ra vầng sáng bảo vệ và kích hoạt `safe_radius`. Đèn chưa thắp không cản được Bóng Mực.
3. **Cơ chế rơi đom đóm khi bị đánh (`hit_drop_ratio = 0.5`)**:
   - *Yêu cầu PRD-0*: "bị chúng chạm vào thì mất máu".
   - *Giả định*: Số đom đóm đánh rơi = `Math.floor(carried * hit_drop_ratio)`. Các đom đóm này rơi xuống mặt đất ngay vị trí bị đánh để người chơi có thể nhặt lại nếu khéo léo.
4. **Điểm thưởng khi Thắng**:
   - *Giả định*: Điểm thưởng cuối ván thắng = `Math.floor(time_left_s) * score.per_second_left + player.flames * score.per_flame_left`.
5. **Rơi khỏi đảo (`fall_enabled = false`)**:
   - *Giả định*: Ở Phase 1, Đảo Đèn Lồng có rào chắn sương hoặc mặt đảo phẳng rộng, `fall_enabled = false`. Người chơi không rơi ra ngoài đảo.
