# Phase 3 Verification Proofs (TICKET-03: "Lanterns Run Out of Fuel")

- **Tag**: `phase-3`
- **Test Contract**: `v1.2`
- **Test Suite Command**: `npm test`
- **Result**: `23/23 passed` (`exit code 0`)

---

## 1. Traceability Matrix (Yêu cầu -> Kiểm chứng -> Kết quả)

| Mã YC | Hạng mục TICKET-03 | Cách kiểm chứng | Kết quả quan sát | Trạng thái |
|---|---|---|---|---:|
| **CONTRACT-1.2** | `game.contract.json` v1.2 khớp `constants.js` | Test tự động `Contract` | Khớp `1.2` và toàn bộ khóa `fuel_max`, `relight_cost`, `win_ratio`, `drain_per_s`, `capacity_max` | **PASS** |
| **P3-FUEL** | Nhiên liệu `100`, tụt `1/s`, `lantern_out`, thắp lại `5` đóm (`+40đ`) | Kịch bản `p3_fuel` | Đèn tắt ở tick 60 (`lantern_out`), thắp lại 5 đom đóm phát `relight: true`, `relit_count: 1`, `score: 65` | **PASS** |
| **P3-REFUEL** | Tiếp nhiên liệu `+10/đóm`, bỏ qua đầy, đẩy lùi khi vượt `>= 30` | Kịch bản `p3_refuel` | Phát `refuel {amount: 5}`, bóng mực trong `6m` bị đẩy ra ngoài rìa sau 35 ticks | **PASS** |
| **P3-DRAIN** | Mất vùng an toàn `< 30`, Bóng Mực `drain` `5/s`, `fuel_drain` mỗi `60t`, Pulse `+15đ` | Kịch bản `p3_drain`, `p3_pulse_drain` | Phát `fuel_drain`, chuyển `state: "drain"`, hút tụt dưới 20, Pulse trúng `drain` cộng `+15` | **PASS** |
| **P3-WIN & CAP** | Thắng bình minh `dawn_survived`, thưởng bình minh, sức chứa `10..20` | Kịch bản `p3_dawn_win`, `p3_dawn_loss`, `REQ-08` | Thắp hết đèn không thắng sớm; hết giờ `>= 3/5` thắng `dawn_survived` (`397đ`), `< 3/5` thua `dawn`; `capacity = 16` | **PASS** |
| **REG-P1-P2** | Hồi quy toàn bộ tính năng Phase 1–2 không bị thay thế | 18 kịch bản hồi quy & hiệu năng | 18/18 đạt; Đêm 3 full 18,000 ticks hoàn thành trong **328.9 ms** | **PASS** |

---

## 2. Kết quả chạy thực tế `npm test`

```text
--- RUNNING SUITE: DAO DEN LONG PHASE 3 (CONTRACT v1.2) ---
  [PASS] Contract: game.contract.json v1.2 matches constants.js TUNING
  [PASS] Browser Safety: Zero node:* imports in src/core/ and src/render/
  [PASS] REQ-02 (Reg): Player movement and camera yaw transformation (6.0 m/s)
  [PASS] REQ-03 (Reg): Mote pickup within 1.0m, no score until deposit
  [PASS] REQ-04 (P3 Updated): Lantern deposit (10 motes) & lantern_lit relight:false (+100 + 10*5 = 150)
  [PASS] REQ-06 (Reg): Pulse stuns 120 ticks, pushes 4m over 15 ticks, +5 score
  [PASS] REQ-05 (Reg): Shade hit -1 flame, drops 50% motes in 1.5-2.5m ring, recoil state, 90t invuln
  [PASS] REQ-08 (P3 Updated): Lighting all lanterns no longer ends Night early
  [PASS] P2-JUMP: Jump physics (v=7, g=-20), landing, no double jump
  [PASS] P2-DASH: Dash 14 m/s for 12 ticks (2.8m), cooldown 90 ticks, air dash keeps Y
  [PASS] P2-FALL: Fall off island (Y < -10) -1 flame, lose all motes, 60t respawn + 90t invuln; 0 flames loses
  [PASS] P2-SAFE: Newly lit lantern pushes shade out of 6m safe_radius within 30 ticks without hitting player
  [PASS] P2-MAP2: Night 2 Bridge & Launch Pad (20,0,18) launches to Island B (70,0,0)
  [PASS] P2-MAP3: Night 3 Cliff, Ramp 30deg, Launch Pad -> Tier 2, Bell Tower & Wind
  [PASS] P2-DRIFT: Drifter (Gió Lạc) chases when carried>=5, steals 3, Pulse causes drifter_drop
  [PASS] P2-CHARM: Wind Charm grants 7.2 m/s speed & 0 dash cooldown for 600 ticks
  [PASS] P2-PAUSE: Pause increments tick while freezing sim_tick, time_left_s, and state="paused"
  [PASS] P2-CONTRACT: Snapshot v1.1 schema + 3-Night Determinism + Invalid Night exit 2
         [Benchmark] Night 3 (18,000 ticks) completed in 328.9 ms
  [PASS] P2-PERF: Full Night 3 simulation (18,000 ticks / 300s) finishes in <= 30s
  [PASS] P3-FUEL: Passive fuel decay (1/s), lantern_out at 0, relight costs 5 motes (+40 score)
  [PASS] P3-REFUEL: Refuel lit lantern (+10 fuel/mote), ignore full, knockback on crossing >= 30
  [PASS] P3-DRAIN: Low-fuel (<30) loses safe zone, Shade drains 5/s, fuel_drain every 60t, Pulse +15
  [PASS] P3-WIN & P3-CAP: Dawn survival win (dawn_survived) + Progressive capacity 10..20

Test results: 23/23 passed.
ALL TESTS PASSED SUCCESSFULLY!
```
