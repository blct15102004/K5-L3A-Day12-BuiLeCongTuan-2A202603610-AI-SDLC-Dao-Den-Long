# Phase 4 Verification Proof — Đảo Đèn Lồng (`v1.0.0` / Contract `v1.3`)

## 1. Test Machine Environment
- **OS**: `Windows_NT 10.0.26300 (x64)`
- **CPU**: `11th Gen Intel(R) Core(TM) i5-11400H @ 2.70GHz` (`12` logical cores)
- **RAM**: `15.7 GB`
- **GPU / WebGL Renderer**: `Custom WebGL 1.0 (ANGLE (Intel, Intel(R) UHD Graphics (0x00009A68) Direct3D11 vs_5_0 ps_5_0, D3D11))`
- **Runtime**: Node.js ES Modules + Google Chrome (`1280×720`, `--disable-gpu-vsync --disable-frame-rate-limit`)

---

## 2. Automated Verification (`verify-phase` & `npm test`)

Command executed: `npm test` (exited with code `0`):
- **Total**: `28/28 passed` (0 skipped, 0 failures)
- **Browser Safety**: `Zero node:* imports in src/core/ and src/render/` — **PASS**
- **Contract Sync**: `game.contract.json v1.3 matches constants.js TUNING and exposes bench/soak cmds` — **PASS**
- **Headless Night 3 Performance (18,000 ticks / 300s)**: `358.8 ms` (`<= 30,000 ms` limit) — **PASS**
- **Phase 4 Feature Tests**:
  - `P4-LB-VAL`: Name validation (`3–12` chars, `[A-Za-z0-9_]` + Vietnamese, rejects invalid/spaces) — **PASS**
  - `P4-LB-SORT`: Top 10 cap, descending `score`, earlier `achieved_at` tie-break, required schema fields — **PASS**
  - `P4-LB-EXPORT`: `node src/server.js --export-leaderboard` writes valid `{"entries": [...]}` and exits `0` — **PASS**
  - `P4-BENCH-SCENE`: Benchmark scene loads Night 1 with L1–L3 `fuel: 100`, `200` `wander` Shades, `100` Motes, zero decay/damage/win-loss — **PASS**
  - `P4-SOAK-SMOKE`: 3-night soak runner smoke test (`crashes === 0`, valid RSS & duration fields) — **PASS**

### Leaderboard Export Check
Command: `node src/server.js --export-leaderboard tests/temp/proof_lb.json`
Observed output:
```json
{
  "entries": []
}
```
Exited cleanly with code `0`.

---

## 3. Soak Test Result (`soak.json`)

Command executed: `node src/headless/soak.js --seed 7 --nights 10 --out soak.json` (exited with code `0`):

```json
{
  "nights": 10,
  "crashes": 0,
  "results": [
    "lost",
    "lost",
    "lost",
    "lost",
    "lost",
    "lost",
    "lost",
    "lost",
    "lost",
    "lost"
  ],
  "mem_start_mb": 45.5,
  "mem_end_mb": 54,
  "duration_s": 0.2
}
```

- **Thresholds**: `crashes == 0` (**PASS**) · `mem_end_mb (54) <= 1.2 * mem_start_mb (54.6)` (**PASS**, ratio `1.187`).

---

## 4. Benchmark Mode Result (`bench.json`)

Command executed: `node src/headless/bench.js --seed 42 --duration 30 --out bench.json` (exited with code `0`):

```json
{
  "contract_version": "1.3",
  "avg_fps": 186,
  "p1_low_fps": 53.7,
  "frame_ms_p95": 6.9,
  "frames": 5582,
  "load_ms": 531,
  "peak_mem_mb": 659.3,
  "vsync_off": true,
  "renderer": "Custom WebGL 1.0 (ANGLE (Intel, Intel(R) UHD Graphics (0x00009A68) Direct3D11 vs_5_0 ps_5_0, D3D11))",
  "os": "Windows_NT 10.0.26300 (x64)"
}
```

- **Thresholds**:
  - `avg_fps >= 60`: **`186`** (**PASS**)
  - `p1_low_fps >= 30`: **`53.7`** (**PASS**)
  - `load_ms <= 10000`: **`531 ms`** (**PASS**)

---

## 5. Requirement Traceability (TICKET-04)
- **Benchmark Mode (`1280×720`, 200 Shades, 100 Motes, L1–L3 lit `fuel:100`, orbiting camera, 3s warmup + 30s measure)**: [src/headless/bench.js](../../src/headless/bench.js), [src/core/game.js](../../src/core/game.js), [src/render/main.js](../../src/render/main.js), [src/render/webgl-renderer.js](../../src/render/webgl-renderer.js)
- **Soak Test (`10` Nights cycling `1->2->3`, seeded input, RSS check)**: [src/headless/soak.js](../../src/headless/soak.js)
- **Local Leaderboard & CLI Export**: [src/core/leaderboard.js](../../src/core/leaderboard.js), [src/server.js](../../src/server.js), [index.html](../../index.html), [src/render/main.js](../../src/render/main.js)
- **Accessibility (Key Rebinding + Conflict Alert, Subtitles + Directional Shade Arrows, Reduced Motion, `>=18px` UI + `×1.25` Large Text, Colorblind)**: [index.html](../../index.html), [src/render/main.js](../../src/render/main.js), [src/render/webgl-renderer.js](../../src/render/webgl-renderer.js)
- **Release Docs & Artifacts**: [LICENSE](../../LICENSE), [CREDITS.md](../../CREDITS.md), [CHANGELOG.md](../../CHANGELOG.md), [README.md](../../README.md), [docs/notes/retrospective.md](../notes/retrospective.md)
