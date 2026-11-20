# Đảo Đèn Lồng (Lantern Island) — v1.0.0

**Đảo Đèn Lồng** là tựa game hành động 3D góc nhìn thứ ba kết hợp engine mô phỏng tất định 60 Hz (`Test Contract v1.3`) qua 3 Đêm chơi: **Đảo Bến**, **Đảo Cau** và **Đảo Chuông**.

Video demo: [docs/demo/demo.mp4](docs/demo/demo.mp4)

---

## 1. System Requirements

- **Runtime**: Node.js `>= 18` (ES Modules, zero external npm dependencies).
- **Browser**: Trình duyệt hỗ trợ WebGL 1.0 & Web Audio API (Google Chrome, Microsoft Edge, Firefox hoặc Safari hiện đại). Để chạy benchmark tự động qua `bench_cmd`, cần Google Chrome / Chromium / Microsoft Edge.
- **OS**: Windows 10/11, macOS, hoặc Linux.

---

## 2. Quick Start (`<= 3` commands)

```bash
# 1. Cài đặt / kiểm tra môi trường
npm install

# 2. Chạy toàn bộ 28 kiểm thử tự động & contract v1.3
npm test

# 3. Khởi động game server 3D + API Bảng Xếp Hạng
npm start
```

Sau khi chạy `npm start` (hoặc `node src/server.js`), mở trình duyệt tại `http://127.0.0.1:3000`.

---

## 3. Game Overview & Scoring (Contract v1.3)

- **Đêm 1 — Đảo Bến** (`240s`): Đảo tròn (`r = 40 m`), 5 đèn lớn (cần tối thiểu `3/5` đèn sáng lúc bình minh).
- **Đêm 2 — Đảo Cau** (`270s`): Đảo đôi (`r = 28 m`) nối bằng cầu tre và 2 bệ phóng, 6 đèn lớn (`>= 4/6`), Bùa Gió (`C1`) và Gió Lạc (Drifters).
- **Đêm 3 — Đảo Chuông** (`300s`): Đảo 3 tầng (`r = 45 m`), vách đá đứng, 2 dốc (`30°`, `150°`), bệ phóng tầng 2, Tháp Chuông trung tâm, 7 đèn lớn (`>= 5/7`), gió giật định kỳ, 2 Bùa Gió và Gió Lạc.
- **Nhiên liệu & Bảo trì đèn**: Đèn sáng bắt đầu ở `fuel = 100`, giảm `1.0/s`; dưới `30` nhiên liệu đèn nhấp nháy (`1 Hz`), mất vùng an toàn `6 m` và Bóng Mực có thể hút `5 fuel/s` (`drain`). Nạp thêm cho đèn đang sáng (`+10` fuel/đom đóm) hoặc thắp lại đèn đã tắt (`5` đom đóm). Sức chứa đom đóm của Mây tăng dần `10 + 2 * successful_lights` (tối đa `20`).
- **Tính điểm**:
  - Nạp đom đóm (thắp mới / thắp lại / tiếp nhiên liệu): **+5 điểm/đom đóm**
  - Thắp đèn lần đầu: **+100 điểm** · Thắp lại đèn từng tắt: **+40 điểm**
  - Trúng Bóng Mực bằng Tỏa Sáng: **+5 điểm** (**+15 điểm** nếu Bóng đang ở trạng thái `drain`)
  - Thưởng qua Đêm (`dawn_survived`): **+50 + floor(fuel)** mỗi đèn còn sáng + **+50** mỗi Ngọn Lửa còn lại.

---

## 4. Controls & Accessibility

### Phím mặc định (có thể đổi toàn bộ trong Cài đặt)
- `W / A / S / D` hoặc các phím Mũi tên: Di chuyển Mây (`6.0 m/s`; `7.2 m/s` khi có Bùa Gió)
- `Space`: Nhảy (`7.0 m/s`)
- `Shift`: Lướt (`14.0 m/s` trong `0.2 s`, hồi chiêu `1.5 s`; `0 s` khi có Bùa Gió)
- `E`: Nạp đom đóm / Thắp lại / Tiếp nhiên liệu cho đèn gần nhất (`<= 2.0 m`)
- `Q` hoặc `F`: Tỏa Sáng / Pulse (`3` đom đóm, bán kính 3D `5.0 m`, choáng `2.0 s` & đẩy lùi `4.0 m`)
- `Esc` hoặc `P`: Tạm dừng / Tiếp tục
- Kéo chuột / Pointer Lock: Xoay góc nhìn camera

### Tính năng Trợ năng (Accessibility)
- **Đổi phím tùy chỉnh**: Hỗ trợ gán lại toàn bộ 9 hành động (`Đi lên/xuống/trái/phải`, `Nhảy`, `Lướt`, `Nạp đèn`, `Tỏa Sáng`, `Tạm dừng`), cảnh báo ngay khi trùng phím và nút Khôi phục mặc định (lưu bền trên `localStorage`).
- **Phụ đề & Chỉ báo hướng**: Banner phụ đề cho các sự kiện quan trọng (Bóng Mực xuất hiện, cảnh báo gió mạnh, 10 giây cuối, đèn `< 30%`) kèm mũi tên chỉ hướng viền màn hình trong 4 giây khi Bóng Mực vừa sinh ra.
- **Chế độ Colorblind / High-Contrast**: Đổi viền & mắt Bóng Mực sang `#00B3FF`, cảnh báo `#FFFFFF` có tiền tố `⚠`, và nén khung/rách giấy 20% với đèn chưa thắp.
- **Giảm chuyển động (Reduced Motion)**: Tắt rung camera, chớp sáng toàn màn hình và hiệu ứng nhấp nháy nhanh.
- **Chữ lớn (Large Text `×1.25`)**: Phóng to giao diện từ cỡ chữ nền `>= 18 px` (ở `1280×720`) lên `×1.25`.

---

## 5. Headless CLI, Benchmark, Soak & Leaderboard

### Chạy mô phỏng Headless (`Test Contract v1.3`)
```bash
node src/headless/cli.js --seed 42 --night 1 --ticks 600 --out output.jsonl
```
Cờ hỗ trợ: `--seed <int>`, `--night <1|2|3>`, `--scenario <file.json>`, `--inputs <file.json>`, `--ticks <int>`, `--out <file.jsonl>`, `--snapshot-every <int>`.

### Benchmark Mode (3D WebGL Performance)
```bash
node src/headless/bench.js --seed 42 --duration 30 --out bench.json
```
- Tự động mở cửa sổ Chrome/Edge kích thước `1280×720` (non-fullscreen) với cờ `--disable-gpu-vsync --disable-frame-rate-limit` (trường `vsync_off: true`; trên một số cấu hình trình điều khiển đồ họa buộc VSync ở cấp hệ điều hành/compositor DWM của Windows, tốc độ khung hình vẫn phản ánh phép đo thực tế của trình duyệt ở độ phân giải này).
- Tải Đêm 1 với đèn L1–L3 sáng (`fuel: 100`), 200 Bóng Mực (`wander`), 100 đom đóm, tắt các hiệu ứng sáng tạo ngoài chuẩn; camera quay quanh `(0,0,0)` ở bán kính `30 m`, cao độ `Y = 15 m` (1 vòng / 15 giây), 3s warm-up + 30s đo thực tế và xuất [bench.json](bench.json).

### Soak Test (Headless Stability)
```bash
node src/headless/soak.js --seed 7 --nights 10 --out soak.json
```
- Chạy liên tiếp 10 Đêm xoay vòng `1 -> 2 -> 3` với `seed = 7 + i`, input ngẫu nhiên theo seed, kiểm tra `crashes == 0` và `mem_end_mb <= 1.2 * mem_start_mb`, xuất [soak.json](soak.json).

### Local Leaderboard CLI Export
```bash
node src/server.js --export-leaderboard out.json
```
Xuất Top 10 kỷ lục từ `data/leaderboard.json` theo cấu trúc `{"entries": [...]}` (sắp xếp theo `score` giảm dần, hòa điểm ưu tiên `achieved_at` sớm hơn).

---

## 6. Creative Additions (Tắt tự động trong Benchmark & Soak)

1. **Mây & Lồng đèn cầm tay**: Nón lá, áo tơi kem, khăn đỏ 2 đoạn bay theo nhịp bước, dư ảnh khi lướt và độ sáng đèn cầm tay tỉ lệ thuận với số đom đóm đang mang.
2. **Nhân vật phụ Ông Đăng & Linh vật Đốm Tiên**: Ông Đăng đứng cạnh trạm khởi đầu phản ứng khi Mây lại gần; Đốm Tiên bay quanh Mây và nghiêng về phía đèn chưa sáng / nhiên liệu `< 30`.
3. **Bóng Mực Tinh Anh & Luồng hút `drain`**: Các Bóng Mực mã số chẵn có sừng đôi & vòng hào quang kép; Bóng ở trạng thái `drain` hiện tia hút từ đèn mục tiêu. *(Toàn bộ nhân vật phụ, biến thể sừng/vòng và hiệu ứng sáng tạo tự động tắt khi `benchmarkMode === true`.)*
4. **Âm thanh Web Audio API tổng hợp**: Nhạc nền ngũ cung cùng toàn bộ hiệu ứng nhảy, lướt, Tỏa Sáng, cảnh báo gió và đếm ngược.

---

## 7. Project Documentation & Artifacts

- [LICENSE](LICENSE) · [CREDITS.md](CREDITS.md) · [CHANGELOG.md](CHANGELOG.md)
- [AGENTS.md](AGENTS.md) · [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md)
- [docs/notes/retrospective.md](docs/notes/retrospective.md): Đánh giá tổng kết qua 4 phase (Phases 1–4).
- [docs/proof/phase-4-proof.md](docs/proof/phase-4-proof.md): Bằng chứng kiểm thử Phase 4 (`bench.json`, `soak.json`, 28/28 tests).
- [docs/proof/phase-1-proof.md](docs/proof/phase-1-proof.md), [phase-2-proof.md](docs/proof/phase-2-proof.md), [phase-3-proof.md](docs/proof/phase-3-proof.md).
- [docs/notes/adr-001-lantern-fuel-and-dawn-win.md](docs/notes/adr-001-lantern-fuel-and-dawn-win.md) & [docs/notes/ai-log.md](docs/notes/ai-log.md).
