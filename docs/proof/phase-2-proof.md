# Phase 2 Verification Proofs (TICKET-02: "Ba hòn đảo")

- **Tag**: `phase-2`
- **Test Contract**: `v1.1`
- **Test Suite Command**: `npm test`
- **Result**: `19/19 passed` (exit code `0`)

---

## 1. Traceability Matrix (Yêu cầu -> Kiểm chứng -> Kết quả)

| Mã YC | Hạng mục TICKET-02 | Cách kiểm chứng | Kết quả quan sát | Trạng thái |
|---|---|---|---|---:|
| **CONTRACT-1.1** | `game.contract.json` khớp tuning chuẩn | Test tự động so khớp JSON với `constants.js` | Khớp 100% `contract_version: "1.1"` và mọi khóa tuning | **PASS** |
| **BROWSER-SAFE** | Không có `node:*` import trong `src/core` & `src/render` | Quét tĩnh toàn bộ file JS | 0 import `node:*` (đã loại bỏ `node:fs` khỏi `constants.js`) | **PASS** |
| **REG-02..08** | Regression Phase 1 theo số liệu chuẩn hóa | `npm test` (6 kịch bản regression) | Di chuyển 6 m/s, nhặt <= 1.0 m, nạp 10 đom đóm (+10/con +100 đèn), Pulse 3 đóm đẩy 4 m trong 15 tick / choáng 120 tick (+5đ), hit 1.0 m rơi 50% + recoil 60t, thắng `all_lit` | **PASS** |
| **P2-JUMP** | Nhảy (`v=7`, `g=-20`, không nhảy kép) | Kịch bản `jump` | Lên không trung ở tick 10, bỏ qua nhảy lần 2 trên không, đáp đất ở tick 50 | **PASS** |
| **P2-DASH** | Lướt (`14 m/s`, `12 tick`, hồi `90 tick`, giữ Y trên không) | Kịch bản `dash` & `airdash` | Di chuyển đúng `2.8 m` sau 12 tick, event `dash {}`, độ cao Y giữ nguyên khi lướt trên không | **PASS** |
| **P2-FALL** | Rơi khỏi đảo (`Y < -10`), mất hết đom đóm, chờ 60t hồi sinh | Kịch bản `fall` & `fall_loss` | Bỏ qua bất tử, `player_hit {by:"fall", lost:4}`, hồi sinh `(0,0,0)` + bất tử 90t; còn 1 lửa -> thua ngay `no_flames` | **PASS** |
| **P2-SAFE** | Vùng an toàn `6 m` đẩy bóng bên trong trong <= 30 tick | Kịch bản `safe` | Bóng Mực `S1` bị đẩy ra ngoài `6 m` mà không gây sát thương cho Mây | **PASS** |
| **P2-MAP2** | Đêm 2 Đảo Cau: cầu tre & bục nhảy `(20,0,18)` | Kịch bản `night2_pad` | Phóng lên bay sang đáp an toàn trên đảo B tâm `(70,0,0)` | **PASS** |
| **P2-MAP3** | Đêm 3 Đảo Chuông: dốc 30°, bục nhảy lên tầng 2, Tháp Chuông, gió | Kịch bản `n3_ramp`, `n3_pad`, `n3_tower`, `n3_wind` | Leo dốc lên `Y=3`, phóng từ `(0,3,13)` đáp tầng 2 `Y=6`, Tháp Chuông `r=2` chặn, gió đẩy người chơi ở tick 1850 | **PASS** |
| **P2-DRIFT** | Gió Lạc (chase, cướp 3, Pulse -> `drifter_drop`, `removed`) | Kịch bản `drifter` | Cướp `3` dù Mây đang bất tử; Tỏa Sáng lúc đang `flee` thả lại 3 đom đóm và biến mất sau 120 tick | **PASS** |
| **P2-CHARM** | Bùa Gió (`7.2 m/s`, lướt 0 hồi chiêu 600 tick, respawn 2700t) | Kịch bản `charm` | Phát `charm_picked`, thực hiện 2 lần Lướt liên tiếp không hồi chiêu | **PASS** |
| **P2-PAUSE** | Tạm dừng (`paused`/`resumed`, `tick` tăng, `sim_tick` đứng yên) | Kịch bản `pause` | `state: "paused"`, `sim_tick` và `time_left_s` giữ nguyên suốt khi tạm dừng | **PASS** |
| **P2-DET** | Tất định 3 Đêm & Schema Snapshot v1.1 + Exit code 2 | Kịch bản `det_n1..n3` & `--night 9` | 2 lần chạy cùng seed giống hệt nhau byte-for-byte ở cả 3 Đêm; `--night 9` thoát mã `2` | **PASS** |
| **P2-PERF** | Benchmark Đêm 3 full 21,600 tick <= 30s | Kịch bản `perf_n3` | Hoàn thành 21,600 tick trong **332.3 ms** (nhanh hơn ngưỡng 30,000 ms ~90 lần) | **PASS** |

---

## 2. Kết quả chạy thực tế `npm test`

```text
--- RUNNING SUITE: DAO DEN LONG PHASE 2 (CONTRACT v1.1) ---
  [PASS] Contract: game.contract.json v1.1 matches constants.js TUNING
  [PASS] Browser Safety: Zero node:* imports in src/core/ and src/render/
  [PASS] REQ-02 (Reg): Player movement and camera yaw transformation (6.0 m/s)
  [PASS] REQ-03 (Reg): Mote pickup within 1.0m, no score until deposit
  [PASS] REQ-04 (Reg): Lantern deposit (10 motes) & lantern_lit (+100 score + 10*10)
  [PASS] REQ-06 (Reg): Pulse stuns 120 ticks, pushes 4m over 15 ticks, +5 score
  [PASS] REQ-05 (Reg): Shade hit -1 flame, drops 50% motes in 1.5-2.5m ring, recoil state, 90t invuln
  [PASS] REQ-08 (Reg): Win game on all lanterns lit + bonus score
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
         [Benchmark] Night 3 (21,600 ticks) completed in 332.3 ms
  [PASS] P2-PERF: Full Night 3 simulation (21,600 ticks) finishes in <= 30s

Test results: 19/19 passed.
ALL TESTS PASSED SUCCESSFULLY!
```
