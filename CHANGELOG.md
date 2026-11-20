# Changelog — Đảo Đèn Lồng

## [v1.0.0 / Phase 4 / Contract v1.3] — TICKET-04: "Dawn: v1.0.0 Release"

### Added
- **Benchmark Mode (`src/headless/bench.js`)**: Automated `1280×720` windowed WebGL benchmark launching Chrome/Edge with `--disable-gpu-vsync`, rendering Night 1 (L1–L3 lit `fuel: 100`, 200 `wander` Ink Shades, 100 fireflies, 3s warmup + `--duration` measurement) and outputting `bench.json` with `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`, `load_ms`, `peak_mem_mb`, `vsync_off`, `renderer`, and `os`.
- **Soak Test (`src/headless/soak.js`)**: Single-process headless runner executing 10 consecutive Nights cycling 1→2→3 (`seed + i`) with seeded random movement/actions, tracking RSS memory growth (`mem_start_mb` -> `mem_end_mb`) and outputting `soak.json`.
- **Local Leaderboard (`src/core/leaderboard.js`, `src/server.js`, UI)**: Persistent Top 10 high-score board (sorted descending by `score`, tie-breaking by earlier `achieved_at`), `3–12` character player name prompt on Victory or Defeat, Main Menu viewer modal, and `node src/server.js --export-leaderboard <out.json>` CLI export (`{"entries": [...]}`).
- **Accessibility Suite (`index.html`, `src/render/main.js`)**:
  - Full control rebinding (4 moves, jump, dash, interact, pulse, pause) with duplicate-key conflict alerts and Reset to Defaults.
  - Real-time subtitle announcements (Shade spawn, wind gusts, final 10s, low-fuel `< 30`) and 4s directional off-screen Shade edge indicators.
  - **Reduced Motion** toggle disabling camera shake, flash overlays, and rapid blinking.
  - **Large Text (`×1.25`)** toggle scaling UI typography cleanly from `>= 18 px` base HUD size at `1280×720`.
- **WebGL Batching & Performance (`src/render/webgl-renderer.js`, `src/render/matrix4.js`)**: Zero-allocation `setTRS` matrix updates, VBO/attribute bind caching, and low-poly sphere batching for motes and Ink Shades, with creative entities/extra VFX disabled during benchmark/soak scenes.
- **Release & Documentation**: Added `LICENSE` (MIT), updated `CREDITS.md`, `README.md`, `AGENTS.md`, `docs/notes/retrospective.md`, `docs/proof/phase-4-proof.md`, and distributable ZIP package (`dist/dao-den-long-v1.0.0.zip`).

## [Phase 3 / Contract v1.2] — TICKET-03: "Lanterns Run Out of Fuel"

### Breaking Changes (`[REPLACED]` from Contract v1.0 / v1.1)
- **Lantern Fuel & Refueling**: Lit lanterns now start at `fuel = 100`, decay passively at `1.0/s` (`1/60` per tick), and extinguish (`lantern_out`) when `fuel <= 0`. Lit lanterns with `fuel < 100` can be refueled (`+10` fuel per firefly). Previously lit lanterns (`ever_lit: true`) cost `5` fireflies to relight instead of `10`.
- **Safe Zone Threshold & Shadow `drain` State**: Lanterns with `fuel < 30` lose their `6 m` safe zone. Wandering Shades target low-fuel lanterns (`fuel < 30`) and drain `5 fuel/s` within `<= 2 m` (`state: "drain"`). Refueling a lantern to `>= 30` pushes nearby Shades out over `<= 30` ticks.
- **Dawn-Only Win Condition**: Lighting all lanterns no longer ends the Night early (`all_lit` deprecated). Nights now last `240s / 270s / 300s` (Nights 1/2/3). Winning requires surviving until dawn with `>= ceil(0.6 * total_lanterns)` lit (`3/5`, `4/6`, `5/7`), emitting `game_over` with `reason: "dawn_survived"`.
- **Scoring Overhaul**:
  - Firefly deposited (light, relight, or refuel): `+5` (was `+10`).
  - Initial lantern light: `+100`; Relight: `+40`.
  - Pulse hit: `+5` normal, `+15` if Shade was in `drain` state.
  - Dawn bonus (win only): `+50 + floor(fuel)` per lit lantern + `+50` per remaining Flame. Time bonus (`per_second_left`) removed.
- **Progressive Carrying Capacity**: Starts at `10` per Night and increases by `+2` per `successful_lights` up to `20`.
- **Colorblind / High-Contrast Mode**: Persistent setting switching Shade outline/eyes to `#00B3FF`, UI warnings to `#FFFFFF` with `⚠`, plus 20% vertical compression and paper-tear visuals on unlit lanterns.
- **Test Contract v1.2**: Updated `game.contract.json`, snapshot fields (`lanterns[].{fuel, ever_lit, relit_count}`, `player.capacity`), scenario fields (`player.successful_lights`, `lanterns[].{fuel, ever_lit}`, `shades[].target_lantern_id`), and events (`refuel`, `lantern_out`, `fuel_drain`, `lantern_lit.relight`).

## [Phase 2 / Contract v1.1] — TICKET-02: "Ba hòn đảo"
- Standardized physics/tuning, added Jump, Dash, Fall/Respawn, Night 2 (Đảo Cau) & Night 3 (Đảo Chuông), Drifters (Gió Lạc), Wind Charms, 3-Night campaign UI, Pause, Settings, Audio, and Standard Palette.

## [Phase 1 / Contract v1.0] — PRD-0: "Đảo Bến"
- Initial 3D WebGL game, deterministic 60Hz core engine, and headless CLI.
